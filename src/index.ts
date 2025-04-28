import { Hono } from 'hono';
import { cors } from 'hono/cors'; // Import the CORS middleware

const app = new Hono();

// --- 直接嵌入静态页面内容 ---
const staticPageContent = `
<!DOCTYPE html>
<html lang="zh-CN">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cloudflare 域名管理</title>
    <!-- Tailwind CSS via CDN -->
    <script src="https://cdn.tailwindcss.com/3.4.1"></script> <!-- Updated to a specific 3.x version -->
    <!-- Font Awesome via CDN -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
    <!-- Updated to a newer version -->
    <style>
        /* Simple transition for showing/hiding elements */
        .fade-enter-active,
        .fade-leave-active {
            transition: opacity 0.3s ease;
        }

        .fade-enter-from,
        .fade-leave-to {
            opacity: 0;
        }

        /* Style for active filter button */
        .filter-btn.active {
            background-color: #3b82f6;
            /* bg-blue-500 */
            color: white;
        }

        /* Ensure modals are visually above others */
        #dns-modal,
        #record-form-modal,
        #domain-form-modal,
        #confirm-modal {
            z-index: 50;
        }

        #notification {
            z-index: 60;
        }

        /* Loading overlay */
        .loading-overlay {
            position: absolute;
            inset: 0;
            background-color: rgba(255, 255, 255, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 40;
            /* Below modals */
        }

        /* Disable buttons during loading */
        button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }

        /* Custom scrollbar for modals if needed */
        .modal-scrollable::-webkit-scrollbar {
            width: 8px;
        }

        .modal-scrollable::-webkit-scrollbar-track {
            background: #f1f1f1;
            border-radius: 10px;
        }

        .modal-scrollable::-webkit-scrollbar-thumb {
            background: #888;
            border-radius: 10px;
        }

        .modal-scrollable::-webkit-scrollbar-thumb:hover {
            background: #555;
        }

        body {
            display: flex;
            flex-direction: column;
            min-height: 100vh;
            /* Ensure body takes at least full viewport height */
        }

        .container {
            flex: 1;
            /* Allows the main content container to grow */
        }
    </style>
</head>

<body class="bg-gray-100 min-h-screen font-sans">
    <div class="container mx-auto px-4 py-8 relative">
        <!-- Loading Overlay -->
        <div id="loading-indicator" class="loading-overlay hidden">
            <i class="fas fa-spinner fa-spin text-blue-500 text-4xl"></i>
        </div>

        <!-- 顶部导航栏 -->
        <nav class="bg-white shadow-lg rounded-lg mb-8 p-4 flex flex-wrap justify-between items-center gap-4">
            <div class="flex items-center">
                <i class="fa-solid fa-cloud text-orange-500 text-3xl mr-3"></i>
                <h1 class="text-2xl font-bold text-gray-800">Cloudflare 域名管理</h1>
            </div>
            <div id="user-info" class="hidden flex items-center flex-wrap gap-2">
                <span id="user-email-display" class="text-gray-600 mr-4 text-sm sm:text-base">欢迎回来</span>
                <button id="logout-btn"
                    class="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded transition duration-150 ease-in-out text-sm">
                    <i class="fa-solid fa-right-from-bracket mr-1 sm:mr-2"></i>退出
                </button>
            </div>
        </nav>

        <!-- API 配置面板 -->
        <div id="api-setup" class="bg-white shadow-lg rounded-lg p-6 mb-8 transition-opacity duration-300 ease-in-out">
            <h2 class="text-xl font-bold mb-4 text-gray-800 flex items-center">
                <i class="fa-solid fa-key text-purple-500 mr-2"></i>API 配置
            </h2>
            <p class="text-sm text-yellow-700 bg-yellow-100 p-3 rounded mb-4 border border-yellow-300"><i
                    class="fas fa-exclamation-triangle mr-2"></i><strong>安全警告:</strong> 请优先使用具有严格限制权限的 API
                Token。直接在浏览器中存储 Global API Key 存在安全风险。</p>
            <div class="mb-4">
                <label class="block text-gray-700 mb-2 font-medium" for="api-key">API Key 或 API Token</label>
                <div class="flex">
                    <input type="password" id="api-key"
                        class="flex-grow border rounded-l py-2 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="输入您的 Cloudflare API Key / Token">
                    <button id="toggle-password" type="button"
                        class="bg-gray-200 px-3 border-t border-r border-b border-gray-300 rounded-r hover:bg-gray-300 transition duration-150 ease-in-out"
                        title="显示/隐藏">
                        <i id="toggle-password-icon" class="fa-solid fa-eye text-gray-600"></i>
                    </button>
                </div>
            </div>
            <div class="mb-4">
                <label class="block text-gray-700 mb-2 font-medium" for="email">Email (若使用 API Key)</label>
                <input type="email" id="email"
                    class="w-full border rounded py-2 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="若使用 Global API Key，请输入关联的 Email">
                <p class="text-xs text-gray-500 mt-1">如果使用 API Token，此项可留空。</p>
            </div>
            <button id="save-api"
                class="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded flex items-center transition duration-150 ease-in-out">
                <i class="fa-solid fa-save mr-2"></i>验证并保存
            </button>
        </div>

        <!-- 域名管理部分 -->
        <div id="domain-management" class="hidden transition-opacity duration-300 ease-in-out">
            <!-- Search, Add, Filter -->
            <div class="bg-white shadow-lg rounded-lg p-6 mb-6">
                <div class="flex flex-col sm:flex-row justify-between items-center mb-4 gap-3">
                    <h2 class="text-xl font-bold text-gray-800 flex items-center">
                        <i class="fa-solid fa-globe text-blue-500 mr-2"></i>域名管理
                    </h2>
                    <div class="flex flex-wrap gap-2 justify-center sm:justify-end">
                        <div class="relative">
                            <input type="text" id="search-domain"
                                class="border rounded-md pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full sm:w-auto"
                                placeholder="搜索域名...">
                            <i
                                class="fa-solid fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
                        </div>
                        <button id="add-domain"
                            class="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded flex items-center transition duration-150 ease-in-out">
                            <i class="fa-solid fa-plus mr-2"></i>添加域名
                        </button>
                        <button id="refresh-list"
                            class="bg-cyan-500 hover:bg-cyan-600 text-white px-4 py-2 rounded transition duration-150 ease-in-out"
                            title="刷新列表">
                            <i class="fa-solid fa-sync"></i>
                        </button>
                    </div>
                </div>
                <!-- Filter Options -->
                <div class="flex flex-wrap gap-2 mb-3 items-center">
                    <span class="text-gray-600 py-1 mr-2 font-medium text-sm">过滤状态:</span>
                    <button
                        class="filter-btn active bg-blue-500 text-white px-3 py-1 rounded text-sm transition duration-150 ease-in-out"
                        data-filter="all">全部</button>
                    <button
                        class="filter-btn bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded text-sm transition duration-150 ease-in-out"
                        data-filter="active">已激活</button>
                    <button
                        class="filter-btn bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded text-sm transition duration-150 ease-in-out"
                        data-filter="pending">待处理</button>
                    <button
                        class="filter-btn bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded text-sm transition duration-150 ease-in-out"
                        data-filter="initializing">初始化中</button>
                    <button
                        class="filter-btn bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded text-sm transition duration-150 ease-in-out"
                        data-filter="moved">已移动</button>
                    <button
                        class="filter-btn bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded text-sm transition duration-150 ease-in-out"
                        data-filter="deleted">已删除</button>
                    <button
                        class="filter-btn bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded text-sm transition duration-150 ease-in-out"
                        data-filter="deactivated">已停用</button>
                </div>
            </div>

            <!-- Domain List Table -->
            <div class="bg-white shadow-lg rounded-lg overflow-hidden">
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th
                                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    域名</th>
                                <th
                                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    状态</th>
                                <th
                                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    计划</th>
                                <th
                                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    名称服务器</th>
                                <th
                                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    操作</th>
                            </tr>
                        </thead>
                        <tbody id="domain-list" class="bg-white divide-y divide-gray-200">
                            <!-- Rows will be populated by JavaScript -->
                            <tr id="domain-loading-row" class="hidden">
                                <td colspan="5" class="px-6 py-4 text-center text-gray-500"><i
                                        class="fas fa-spinner fa-spin mr-2"></i>加载域名中...</td>
                            </tr>
                            <tr id="domain-no-results-row" class="hidden">
                                <td colspan="5" class="px-6 py-4 text-center text-gray-500">未找到域名或凭据无效。</td>
                            </tr>
                            <tr id="domain-error-row" class="hidden">
                                <td colspan="5" class="px-6 py-4 text-center text-red-600"><i
                                        class="fas fa-exclamation-circle mr-2"></i>加载域名时出错。请检查控制台。</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <!-- Pagination Placeholder -->
                <div id="domain-pagination" class="bg-white px-4 py-3 border-t border-gray-200 sm:px-6">
                    <!-- Pagination controls will be added here if needed -->
                </div>
            </div>
        </div>

        <!-- DNS 记录管理模态框 -->
        <div id="dns-modal"
            class="hidden fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center p-4 fade-enter-active fade-leave-active">
            <div class="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col">
                <div class="p-6 border-b border-gray-200">
                    <div class="flex justify-between items-center">
                        <h3 class="text-lg font-bold text-gray-900 flex items-center">
                            <i class="fa-solid fa-list text-blue-500 mr-2"></i>
                            <span id="dns-modal-domain" class="domain-name">example.com</span> - DNS 记录管理
                        </h3>
                        <button id="close-dns-modal" type="button"
                            class="text-gray-400 hover:text-gray-600 transition duration-150 ease-in-out">
                            <i class="fa-solid fa-times text-xl"></i>
                        </button>
                    </div>
                </div>
                <div class="p-6 flex-grow overflow-y-auto relative modal-scrollable">
                    <!-- DNS Loading Overlay -->
                    <div id="dns-loading-indicator" class="loading-overlay hidden">
                        <i class="fas fa-spinner fa-spin text-blue-500 text-3xl"></i>
                    </div>
                    <!-- Add Record Button -->
                    <div class="mb-4">
                        <button id="add-record-btn" type="button"
                            class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded flex items-center transition duration-150 ease-in-out">
                            <i class="fa-solid fa-plus mr-2"></i>添加记录
                        </button>
                    </div>
                    <!-- DNS Records Table -->
                    <div class="overflow-x-auto">
                        <table class="min-w-full divide-y divide-gray-200">
                            <thead class="bg-gray-50 sticky top-0 z-10">
                                <tr>
                                    <th
                                        class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        类型</th>
                                    <th
                                        class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        名称</th>
                                    <th
                                        class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        内容</th>
                                    <th
                                        class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        TTL</th>
                                    <th
                                        class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        代理</th>
                                    <th
                                        class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        操作</th>
                                </tr>
                            </thead>
                            <tbody id="dns-records" class="bg-white divide-y divide-gray-200">
                                <!-- Rows populated by JS -->
                                <tr id="dns-no-records" class="hidden">
                                    <td colspan="6" class="text-center p-4 text-gray-500">此域没有 DNS 记录。</td>
                                </tr>
                                <tr id="dns-error-row" class="hidden">
                                    <td colspan="6" class="px-6 py-4 text-center text-red-600"><i
                                            class="fas fa-exclamation-circle mr-2"></i>加载 DNS 记录时出错。</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
                <div class="p-4 bg-gray-50 border-t border-gray-200 text-right">
                    <button id="close-dns-modal-footer" type="button"
                        class="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded text-gray-800 transition duration-150 ease-in-out">关闭</button>
                </div>
            </div>
        </div>

        <!-- 添加/编辑 DNS 记录模态框 -->
        <div id="record-form-modal"
            class="hidden fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center p-4 fade-enter-active fade-leave-active">
            <div class="bg-white rounded-lg shadow-xl w-full max-w-lg">
                <form id="dns-record-form">
                    <input type="hidden" id="record-id" value="">
                    <input type="hidden" id="current-zone-id" value="">
                    <input type="hidden" id="current-zone-name" value=""> <!-- Added to store zone name -->
                    <div class="p-6 border-b border-gray-200">
                        <div class="flex justify-between items-center">
                            <h3 class="text-lg font-bold text-gray-900" id="record-form-title">添加 DNS 记录</h3>
                            <button type="button" id="close-record-form"
                                class="text-gray-400 hover:text-gray-600 transition duration-150 ease-in-out">
                                <i class="fa-solid fa-times text-xl"></i>
                            </button>
                        </div>
                    </div>
                    <div class="p-6 space-y-4 max-h-[60vh] overflow-y-auto modal-scrollable">
                        <!-- Record Type -->
                        <div>
                            <label class="block text-gray-700 mb-1 font-medium" for="record-type">记录类型</label>
                            <select id="record-type"
                                class="w-full border rounded py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                                required>
                                <option value="A">A (IPv4 Address)</option>
                                <option value="AAAA">AAAA (IPv6 Address)</option>
                                <option value="CNAME">CNAME (Canonical Name)</option>
                                <option value="MX">MX (Mail Exchange)</option>
                                <option value="TXT">TXT (Text Record)</option>
                                <option value="NS">NS (Name Server)</option>
                                <option value="SRV">SRV (Service Record)</option>
                                <option value="CAA">CAA (Certification Authority Authorization)</option>
                                <option value="PTR">PTR (Pointer Record)</option>
                                <!-- Add other common types if needed -->
                            </select>
                        </div>
                        <!-- Name -->
                        <div>
                            <label class="block text-gray-700 mb-1 font-medium" for="record-name">名称</label>
                            <input type="text" id="record-name"
                                class="w-full border rounded py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="@ 代表根域名" required>
                            <p class="text-xs text-gray-500 mt-1">例如: @, www, mail, sub, * (通配符)</p>
                        </div>
                        <!-- Content (Varies by type) -->
                        <div id="content-field-A">
                            <label class="block text-gray-700 mb-1 font-medium" for="record-content-A">IPv4 地址</label>
                            <input type="text" id="record-content-A"
                                class="w-full border rounded py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 record-content-input"
                                placeholder="例如: 192.0.2.1">
                        </div>
                        <div id="content-field-AAAA" class="hidden">
                            <label class="block text-gray-700 mb-1 font-medium" for="record-content-AAAA">IPv6
                                地址</label>
                            <input type="text" id="record-content-AAAA"
                                class="w-full border rounded py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 record-content-input"
                                placeholder="例如: 2001:db8::1">
                        </div>
                        <div id="content-field-CNAME" class="hidden">
                            <label class="block text-gray-700 mb-1 font-medium" for="record-content-CNAME">目标</label>
                            <input type="text" id="record-content-CNAME"
                                class="w-full border rounded py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 record-content-input"
                                placeholder="例如: target.example.com">
                        </div>
                        <div id="content-field-MX" class="hidden">
                            <label class="block text-gray-700 mb-1 font-medium" for="record-content-MX">邮件服务器</label>
                            <input type="text" id="record-content-MX"
                                class="w-full border rounded py-2 px-3 mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 record-content-input"
                                placeholder="例如: mail.example.com">
                            <label class="block text-gray-700 mb-1 font-medium" for="record-priority">优先级</label>
                            <input type="number" id="record-priority"
                                class="w-full border rounded py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="例如: 10" min="0" step="1">
                        </div>
                        <div id="content-field-TXT" class="hidden">
                            <label class="block text-gray-700 mb-1 font-medium" for="record-content-TXT">内容</label>
                            <textarea id="record-content-TXT" rows="3"
                                class="w-full border rounded py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 record-content-input"
                                placeholder="例如: v=spf1 include:_spf.google.com ~all"></textarea>
                        </div>
                        <div id="content-field-NS" class="hidden">
                            <label class="block text-gray-700 mb-1 font-medium" for="record-content-NS">名称服务器</label>
                            <input type="text" id="record-content-NS"
                                class="w-full border rounded py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 record-content-input"
                                placeholder="例如: ns1.example.com">
                        </div>
                        <div id="content-field-PTR" class="hidden">
                            <label class="block text-gray-700 mb-1 font-medium" for="record-content-PTR">域名</label>
                            <input type="text" id="record-content-PTR"
                                class="w-full border rounded py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 record-content-input"
                                placeholder="例如: host.example.com">
                        </div>
                        <!-- SRV requires more fields -->
                        <div id="content-field-SRV" class="hidden space-y-2">
                            <label class="block text-gray-700 mb-1 font-medium">服务详情</label>
                            <div class="grid grid-cols-2 gap-2">
                                <div>
                                    <label class="block text-gray-700 text-sm mb-1" for="srv-service">服务</label>
                                    <input type="text" id="srv-service" class="w-full border rounded py-2 px-3 text-sm"
                                        placeholder="_sip">
                                </div>
                                <div>
                                    <label class="block text-gray-700 text-sm mb-1" for="srv-proto">协议</label>
                                    <select id="srv-proto" class="w-full border rounded py-2 px-3 text-sm bg-white">
                                        <option value="_tcp">TCP</option>
                                        <option value="_udp">UDP</option>
                                        <option value="_tls">TLS</option>
                                    </select>
                                </div>
                            </div>
                            <div class="grid grid-cols-3 gap-2">
                                <div>
                                    <label class="block text-gray-700 text-sm mb-1" for="srv-priority">优先级</label>
                                    <input type="number" id="srv-priority"
                                        class="w-full border rounded py-2 px-3 text-sm" placeholder="10" min="0">
                                </div>
                                <div>
                                    <label class="block text-gray-700 text-sm mb-1" for="srv-weight">权重</label>
                                    <input type="number" id="srv-weight" class="w-full border rounded py-2 px-3 text-sm"
                                        placeholder="5" min="0">
                                </div>
                                <div>
                                    <label class="block text-gray-700 text-sm mb-1" for="srv-port">端口</label>
                                    <input type="number" id="srv-port" class="w-full border rounded py-2 px-3 text-sm"
                                        placeholder="5060" min="1" max="65535">
                                </div>
                            </div>
                            <div>
                                <label class="block text-gray-700 text-sm mb-1" for="srv-target">目标</label>
                                <input type="text" id="srv-target"
                                    class="w-full border rounded py-2 px-3 text-sm record-content-input"
                                    placeholder="sip.example.com">
                            </div>
                        </div>
                        <!-- CAA requires flags, tag, value -->
                        <div id="content-field-CAA" class="hidden space-y-2">
                            <label class="block text-gray-700 mb-1 font-medium">CAA 设置</label>
                            <div class="grid grid-cols-3 gap-2">
                                <div>
                                    <label class="block text-gray-700 text-sm mb-1" for="caa-flags">标记</label>
                                    <input type="number" id="caa-flags" class="w-full border rounded py-2 px-3 text-sm"
                                        placeholder="0" min="0" max="255">
                                </div>
                                <div class="col-span-2">
                                    <label class="block text-gray-700 text-sm mb-1" for="caa-tag">标签</label>
                                    <select id="caa-tag" class="w-full border rounded py-2 px-3 text-sm bg-white">
                                        <option value="issue">issue (允许颁发证书)</option>
                                        <option value="issuewild">issuewild (允许颁发通配符证书)</option>
                                        <option value="iodef">iodef (报告违规)</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label class="block text-gray-700 text-sm mb-1" for="caa-value">值</label>
                                <input type="text" id="caa-value"
                                    class="w-full border rounded py-2 px-3 text-sm record-content-input"
                                    placeholder="letsencrypt.org">
                            </div>
                        </div>

                        <!-- Fallback for other types -->
                        <div id="content-field-generic" class="hidden">
                            <label class="block text-gray-700 mb-1 font-medium" for="record-content-generic">内容</label>
                            <input type="text" id="record-content-generic"
                                class="w-full border rounded py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 record-content-input"
                                placeholder="记录内容">
                        </div>
                        <!-- TTL -->
                        <div>
                            <label class="block text-gray-700 mb-1 font-medium" for="record-ttl">TTL (生存时间)</label>
                            <select id="record-ttl"
                                class="w-full border rounded py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white">
                                <option value="1">自动 (推荐)</option>
                                <option value="60">1 分钟</option>
                                <option value="120">2 分钟</option>
                                <option value="300">5 分钟</option>
                                <option value="600">10 分钟</option>
                                <option value="900">15 分钟</option>
                                <option value="1800">30 分钟</option>
                                <option value="3600">1 小时</option>
                                <option value="7200">2 小时</option>
                                <option value="18000">5 小时</option>
                                <option value="43200">12 小时</option>
                                <option value="86400">1 天</option>
                            </select>
                        </div>
                        <!-- Proxy Status -->
                        <div class="flex items-center" id="proxy-toggle-container">
                            <label class="inline-flex items-center mr-4 cursor-pointer">
                                <input type="checkbox" id="proxy-status"
                                    class="form-checkbox h-5 w-5 rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-offset-0 focus:ring-blue-200 focus:ring-opacity-50">
                                <span class="ml-2 text-gray-700">代理状态 (橙色云)</span>
                            </label>
                            <i class="fa-solid fa-info-circle text-gray-400"
                                title="通过 Cloudflare 代理流量以获得安全和性能优势。仅适用于 A, AAAA, CNAME 记录。"></i>
                        </div>
                    </div>
                    <div class="p-4 bg-gray-50 border-t border-gray-200 flex justify-end space-x-2">
                        <button type="button" id="cancel-record"
                            class="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded text-gray-800 transition duration-150 ease-in-out">取消</button>
                        <button type="submit" id="save-record-btn"
                            class="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded text-white transition duration-150 ease-in-out">保存记录</button>
                    </div>
                </form>
            </div>
        </div>

        <!-- 添加域名模态框 -->
        <div id="domain-form-modal"
            class="hidden fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center p-4 fade-enter-active fade-leave-active">
            <div class="bg-white rounded-lg shadow-xl w-full max-w-md">
                <form id="domain-form">
                    <div class="p-6 border-b border-gray-200">
                        <div class="flex justify-between items-center">
                            <h3 class="text-lg font-bold text-gray-900">添加新域名</h3>
                            <button type="button" id="close-domain-form"
                                class="text-gray-400 hover:text-gray-600 transition duration-150 ease-in-out">
                                <i class="fa-solid fa-times text-xl"></i>
                            </button>
                        </div>
                    </div>
                    <div class="p-6 space-y-4">
                        <div>
                            <label class="block text-gray-700 mb-1 font-medium" for="domain-name">域名</label>
                            <input type="text" id="domain-name"
                                class="w-full border rounded py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="example.com" required>
                            <p class="text-xs text-gray-500 mt-1">请输入不带 http:// 或 https:// 的域名。</p>
                        </div>
                        <!-- Account Selection (Hidden for simplicity, assuming single/first account) -->
                        <!--
                         <div class="mb-4">
                            <label class="block text-gray-700 mb-1 font-medium" for="account-id-select">账户</label>
                            <select id="account-id-select" class="w-full border rounded py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" required>
                                <option value="" disabled selected>选择账户...</option>
                            </select>
                         </div>
                         -->
                        <p class="text-sm text-gray-600">域名将添加到与您的 API 凭证关联的第一个账户中。</p>
                    </div>
                    <div class="p-4 bg-gray-50 border-t border-gray-200 flex justify-end space-x-2">
                        <button type="button" id="cancel-domain"
                            class="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded text-gray-800 transition duration-150 ease-in-out">取消</button>
                        <button type="submit" id="add-domain-submit-btn"
                            class="px-4 py-2 bg-green-500 hover:bg-green-600 rounded text-white transition duration-150 ease-in-out">添加域名</button>
                    </div>
                </form>
            </div>
        </div>

        <!-- 警告确认模态框 -->
        <div id="confirm-modal"
            class="hidden fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center p-4 fade-enter-active fade-leave-active">
            <div class="bg-white rounded-lg shadow-xl w-full max-w-md">
                <div class="p-6">
                    <div class="flex flex-col items-center text-center">
                        <div class="text-red-500 mb-4">
                            <i id="confirm-icon" class="fa-solid fa-exclamation-triangle text-5xl"></i>
                        </div>
                        <h3 class="text-lg font-bold text-gray-900 mb-2" id="confirm-title">确认操作</h3>
                        <p class="text-gray-600 mb-6" id="confirm-message">您确定要执行此操作吗？</p>
                    </div>
                    <div class="flex justify-center space-x-4">
                        <button id="cancel-confirm" type="button"
                            class="px-6 py-2 bg-gray-200 hover:bg-gray-300 rounded text-gray-800 transition duration-150 ease-in-out">取消</button>
                        <button id="proceed-confirm" type="button"
                            class="px-6 py-2 bg-red-500 hover:bg-red-600 rounded text-white transition duration-150 ease-in-out">确认</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- 通知提示组件 -->
        <div id="notification"
            class="hidden fixed top-5 right-5 max-w-sm w-full bg-white shadow-lg rounded-lg pointer-events-auto ring-1 ring-black ring-opacity-5 overflow-hidden border-l-4 z-60">
            <div class="p-4">
                <div class="flex items-start">
                    <div id="notification-icon" class="flex-shrink-0 pt-0.5">
                        <!-- Icon set dynamically -->
                    </div>
                    <div class="ml-3 w-0 flex-1">
                        <p id="notification-title" class="text-sm font-medium text-gray-900">通知</p>
                        <p id="notification-message" class="mt-1 text-sm text-gray-500">消息内容</p>
                    </div>
                    <div class="ml-4 flex-shrink-0 flex">
                        <button id="close-notification" type="button"
                            class="bg-white rounded-md inline-flex text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                            <span class="sr-only">Close</span>
                            <i class="fa-solid fa-times h-5 w-5"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <footer class="w-full mt-12 py-4 px-4 border-t border-gray-200 bg-white">
        <div class="container mx-auto text-center text-gray-500 text-sm">
            Copyright &copy; <span id="copyright-year"></span> zhu. All Rights Reserved.
            <br class="sm:hidden"> <!-- Optional: line break on small screens -->
            <!-- <span class="hidden sm:inline mx-2">|</span>
            <a href="#" class="text-blue-600 hover:text-blue-800 hover:underline">Privacy Policy</a>
            <span class="mx-2">|</span>
            <a href="#" class="text-blue-600 hover:text-blue-800 hover:underline">Terms of Service</a> -->
        </div>
    </footer>
    <!-- JavaScript -->
    <script>
        document.addEventListener('DOMContentLoaded', () => {
            // --- Constants ---
            // Use a proxy if needed, otherwise target Cloudflare API directly
            // Example Proxy URL: '/api/cf' -> configure your server to forward requests
            const CLOUDFLARE_API_BASE = '/client/v4'; // Replace with your proxy or keep direct (less secure client-side)

            // --- DOM Elements ---
            const loadingIndicator = document.getElementById('loading-indicator');
            const apiKeyInput = document.getElementById('api-key');
            const emailInput = document.getElementById('email');
            const saveApiButton = document.getElementById('save-api');
            const togglePasswordButton = document.getElementById('toggle-password');
            const togglePasswordIcon = document.getElementById('toggle-password-icon');
            const apiSetupDiv = document.getElementById('api-setup');
            const domainManagementDiv = document.getElementById('domain-management');
            const userInfoDiv = document.getElementById('user-info');
            const userEmailDisplay = document.getElementById('user-email-display');
            const logoutButton = document.getElementById('logout-btn');

            // Domain List Elements
            const domainListBody = document.getElementById('domain-list');
            const domainLoadingRow = document.getElementById('domain-loading-row');
            const domainNoResultsRow = document.getElementById('domain-no-results-row');
            const domainErrorRow = document.getElementById('domain-error-row');
            const searchDomainInput = document.getElementById('search-domain');
            const filterButtons = document.querySelectorAll('.filter-btn');
            const refreshListButton = document.getElementById('refresh-list');

            // Add Domain Modal Elements
            const addDomainButton = document.getElementById('add-domain');
            const domainFormModal = document.getElementById('domain-form-modal');
            const closeDomainFormButton = document.getElementById('close-domain-form');
            const cancelDomainButton = document.getElementById('cancel-domain');
            const domainForm = document.getElementById('domain-form');
            const domainNameInput = document.getElementById('domain-name');
            const addDomainSubmitBtn = document.getElementById('add-domain-submit-btn');


            // DNS Modal Elements
            const dnsModal = document.getElementById('dns-modal');
            const dnsLoadingIndicator = document.getElementById('dns-loading-indicator');
            const closeDnsModalButton = document.getElementById('close-dns-modal');
            const closeDnsModalFooterButton = document.getElementById('close-dns-modal-footer');
            const dnsModalDomainTitle = document.getElementById('dns-modal-domain');
            const dnsRecordsBody = document.getElementById('dns-records');
            const dnsNoRecordsRow = document.getElementById('dns-no-records');
            const dnsErrorRow = document.getElementById('dns-error-row');

            // Add/Edit Record Modal Elements
            const addRecordButton = document.getElementById('add-record-btn');
            const recordFormModal = document.getElementById('record-form-modal');
            const closeRecordFormButton = document.getElementById('close-record-form');
            const cancelRecordButton = document.getElementById('cancel-record');
            const dnsRecordForm = document.getElementById('dns-record-form');
            const recordFormTitle = document.getElementById('record-form-title');
            const recordIdInput = document.getElementById('record-id');
            const currentZoneIdInput = document.getElementById('current-zone-id');
            const currentZoneNameInput = document.getElementById('current-zone-name');
            const recordTypeSelect = document.getElementById('record-type');
            const recordNameInput = document.getElementById('record-name');
            const recordTtlSelect = document.getElementById('record-ttl');
            const proxyStatusCheckbox = document.getElementById('proxy-status');
            const proxyToggleContainer = document.getElementById('proxy-toggle-container');
            // Specific content fields
            const recordContentInputs = document.querySelectorAll('.record-content-input'); // General class for simple content inputs
            const mxPriorityInput = document.getElementById('record-priority');
            const srvServiceInput = document.getElementById('srv-service');
            const srvProtoSelect = document.getElementById('srv-proto');
            const srvPriorityInput = document.getElementById('srv-priority');
            const srvWeightInput = document.getElementById('srv-weight');
            const srvPortInput = document.getElementById('srv-port');
            const srvTargetInput = document.getElementById('srv-target');
            const caaFlagsInput = document.getElementById('caa-flags');
            const caaTagSelect = document.getElementById('caa-tag');
            const caaValueInput = document.getElementById('caa-value');
            const saveRecordBtn = document.getElementById('save-record-btn');

            // Confirmation Modal Elements
            const confirmModal = document.getElementById('confirm-modal');
            const confirmTitle = document.getElementById('confirm-title');
            const confirmMessage = document.getElementById('confirm-message');
            const confirmIcon = document.getElementById('confirm-icon');
            const cancelConfirmButton = document.getElementById('cancel-confirm');
            const proceedConfirmButton = document.getElementById('proceed-confirm');

            // Notification Elements
            const notification = document.getElementById('notification');
            const notificationTitle = document.getElementById('notification-title');
            const notificationMessage = document.getElementById('notification-message');
            const notificationIcon = document.getElementById('notification-icon');
            const closeNotificationButton = document.getElementById('close-notification');

            const copyrightYearSpan = document.getElementById('copyright-year');

            // --- State Variables ---
            let currentApiAuth = { key: null, email: null };
            let currentAccountId = null; // Store the first found account ID
            let currentConfirmCallback = null;
            let notificationTimeout = null;
            let activeDomainFilter = 'all'; // Store current domain filter
            let domainListData = []; // Store fetched domain data for client-side filtering


            // --- Utility Functions ---
            const showLoading = (global = true) => {
                loadingIndicator.classList.remove('hidden');
                if (global) {
                    // Disable major action buttons
                    saveApiButton.disabled = true;
                    addDomainButton.disabled = true;
                    refreshListButton.disabled = true;
                }
            };
            const hideLoading = () => {
                loadingIndicator.classList.add('hidden');
                // Re-enable buttons
                saveApiButton.disabled = false;
                addDomainButton.disabled = false;
                refreshListButton.disabled = false;
            };
            const showDnsLoading = () => dnsLoadingIndicator.classList.remove('hidden');
            const hideDnsLoading = () => dnsLoadingIndicator.classList.add('hidden');

            const showElement = (el) => el && el.classList.remove('hidden');
            const hideElement = (el) => el && el.classList.add('hidden');

            const showModal = (modalEl) => {
                if (!modalEl) return;
                modalEl.classList.remove('hidden');
                // Add focus trap or manage focus manually if needed
                // Force reflow for transition
                requestAnimationFrame(() => {
                    modalEl.classList.add('fade-enter-active');
                    modalEl.classList.remove('fade-enter-from');
                });
            };

            const hideModal = (modalEl) => {
                if (!modalEl || modalEl.classList.contains('hidden')) return;
                modalEl.classList.add('fade-leave-active', 'fade-leave-to');
                modalEl.classList.remove('fade-enter-active');
                setTimeout(() => {
                    modalEl.classList.add('hidden');
                    modalEl.classList.remove('fade-leave-active', 'fade-leave-to');
                    const form = modalEl.querySelector('form');
                    if (form) form.reset();
                    if (modalEl.id === 'record-form-modal') {
                        recordIdInput.value = '';
                        // Reset specific form states if needed
                        updateRecordFormUI('A'); // Reset to default view
                    }
                    if (modalEl.id === 'confirm-modal') currentConfirmCallback = null;
                }, 300); // Match CSS transition duration
            };

            function showNotification(title, message, type = 'success', duration = 5000) {
                notificationTitle.textContent = title;
                notificationMessage.textContent = message;
                notification.classList.remove('border-green-500', 'border-red-500', 'border-yellow-500', 'border-blue-500');
                let iconHtml = '';
                let borderColor = '';

                switch (type) {
                    case 'error':
                        iconHtml = '<i class="fa-solid fa-circle-xmark text-red-500 text-xl"></i>';
                        borderColor = 'border-red-500';
                        break;
                    case 'warning':
                        iconHtml = '<i class="fa-solid fa-triangle-exclamation text-yellow-500 text-xl"></i>';
                        borderColor = 'border-yellow-500';
                        break;
                    case 'info':
                        iconHtml = '<i class="fa-solid fa-circle-info text-blue-500 text-xl"></i>';
                        borderColor = 'border-blue-500';
                        break;
                    case 'success':
                    default:
                        iconHtml = '<i class="fa-solid fa-circle-check text-green-500 text-xl"></i>';
                        borderColor = 'border-green-500';
                        break;
                }
                notificationIcon.innerHTML = iconHtml;
                notification.classList.add(borderColor);
                showElement(notification);
                if (notificationTimeout) clearTimeout(notificationTimeout);
                if (duration > 0) {
                    notificationTimeout = setTimeout(hideNotification, duration);
                }
            }

            function hideNotification() {
                hideElement(notification);
                if (notificationTimeout) clearTimeout(notificationTimeout);
            }

            function showConfirmation(title, message, onConfirm, type = 'warning') {
                confirmTitle.textContent = title;
                confirmMessage.textContent = message;
                currentConfirmCallback = onConfirm;
                // Set icon based on type
                confirmIcon.className = 'fa-solid text-5xl ' + (type === 'danger'
                    ? 'fa-trash-alt text-red-500'
                    : 'fa-exclamation-triangle text-yellow-500');
                // Change button color
                proceedConfirmButton.className = 'px-6 py-2 rounded text-white transition duration-150 ease-in-out ' + (type === 'danger'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-yellow-500 hover:bg-yellow-600'); // Use yellow for warning as default

                showModal(confirmModal);
            }

            // --- Cloudflare API Request Function ---
            async function cloudflareApiRequest(endpoint, method = 'GET', body = null) {
                const { key, email } = currentApiAuth; // Get current credentials from state
                const headers = {
                    'Accept': 'application/json',
                };

                if (key && email) {
                    headers['X-Auth-Key'] = key;
                    headers['X-Auth-Email'] = email;
                } else if (key) {
                    headers['Authorization'] = 'Bearer ' + key; // For API Tokens
                } else {
                    throw new Error('No valid API credentials found.');
                }
                const options = {
                    method,
                    headers,
                };

                if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE')) { // DELETE can sometimes have a body
                    headers['Content-Type'] = 'application/json';
                    options.body = JSON.stringify(body);
                }

                const url = CLOUDFLARE_API_BASE + endpoint; // No backticks

                try {
                    const response = await fetch(url, options);

                    // Handle non-JSON error responses gracefully
                    if (!response.ok) {
                        let errorData;
                        try {
                            errorData = await response.json();
                        } catch (e) {
                            // Response wasn't JSON (e.g., plain text error, HTML error page)
                            throw new Error('Request failed with status ' + response.status + '. Response not JSON.');
                        }
                        // If JSON parsing succeeded but success is false
                        const errorMessages = (errorData.errors || [{ message: 'Unknown API error' }])
                            .map(e => '(' + (e.code || 'N/A') + ') ' + (e.message || 'No message'))
                            .join('; ');
                        console.error('Cloudflare API Error Response:', errorData);
                        throw new Error('API Error (' + response.status + '): ' + errorMessages);
                    }

                    // Handle rate limits specifically if possible (429) - checked after !response.ok
                    if (response.status === 429) {
                        throw new Error("Rate limit exceeded. Please wait and try again.");
                    }

                    // Handle empty success responses (e.g., successful DELETE often returns 204 No Content)
                    if (response.status === 204 || response.headers.get('content-length') === '0') {
                        return { success: true, result: null }; // Mimic CF response structure
                    }

                    const data = await response.json();

                    // Even with status 200, Cloudflare API might return success: false
                    if (data.success === false) {
                        const errorMessages = (data.errors || [{ message: 'Unknown API error' }])
                            .map(e => '(' + (e.code || 'N/A') + ') ' + (e.message || 'No message'))
                            .join('; ');
                        console.error('Cloudflare API Logic Error:', data.errors);
                        throw new Error('API Logic Error: ' + errorMessages);
                    }

                    return data; // Return the full response object (includes result, result_info, etc.)

                } catch (error) {
                    console.error('Error making Cloudflare API request to ' + method + ' ' + endpoint + ':', error);
                    // Re-throw a user-friendly or the original error
                    // Avoid exposing raw network errors directly if possible
                    throw error instanceof Error ? error : new Error("Network error or failed to parse response.");
                }
            }


            // --- Authentication & Initialization ---
            function loadAndValidateCredentials() {
                const savedKey = sessionStorage.getItem('cfApiKey');
                const savedEmail = sessionStorage.getItem('cfEmail'); // Might be null for tokens

                if (savedKey) {
                    currentApiAuth = { key: savedKey, email: savedEmail || null }; // Ensure email is null if not present
                    apiKeyInput.value = savedKey; // Pre-fill form for visibility if needed
                    emailInput.value = savedEmail || '';
                    // Attempt to validate by fetching zones
                    validateCredentialsAndLoadDomains(false); // false = don't show success message on initial load
                } else {
                    // No saved credentials, show setup
                    showElement(apiSetupDiv);
                    hideElement(domainManagementDiv);
                    hideElement(userInfoDiv);
                }
            }

            async function validateCredentialsAndLoadDomains(showSuccessNotification = true) {
                showLoading();
                hideElement(domainErrorRow); // Hide previous errors
                hideElement(domainNoResultsRow);
                showElement(domainLoadingRow);
                domainListBody.innerHTML = ''; // Clear previous list items

                try {
                    // Use list zones with minimal data as a validation check
                    // Also try to get the account ID from the first zone found
                    // Fetch a small number of zones first to validate & get Account ID
                    const validationResponse = await cloudflareApiRequest('/zones?per_page=1'); // Fetch just one zone

                    if (validationResponse.result && validationResponse.result.length > 0) {
                        currentAccountId = validationResponse.result[0].account.id; // Store account ID
                    } else {
                        // If no zones, credentials might still be valid. Try fetching user info if email exists?
                        // For API Tokens, this might not work. We'll proceed but warn.
                        console.warn("Could not automatically determine Account ID from zones. Adding domains might require manual Account ID input if implemented.");
                        // If using API key/email, could try fetching /user
                        if (currentApiAuth.email && !PROXY_ENABLED) {
                            try {
                                const userResponse = await cloudflareApiRequest('/user');
                                currentAccountId = userResponse.result?.account?.id; // Might still be null
                            } catch (userError) {
                                console.warn("Failed to fetch user details:", userError);
                            }
                        }
                        if (!currentAccountId) {
                            // Only show notification if account ID is truly needed and couldn't be found
                            // showNotification('警告', '无法自动确定账户ID，添加域名功能可能受限。', 'warning');
                        }
                    }

                    // Credentials seem valid at this point
                    if (showSuccessNotification) {
                        showNotification('验证成功', 'API 凭证有效。正在加载域名...', 'success', 3000);
                    }
                    // Display user info (email or generic token message)
                    userEmailDisplay.textContent = currentApiAuth.email ? '账户: ' + currentApiAuth.email : '已验证 Token';
                    hideElement(apiSetupDiv);
                    showElement(domainManagementDiv);
                    showElement(userInfoDiv);

                    // Now fetch the full list of domains
                    await fetchAndRenderDomains();

                } catch (error) {
                    console.error("Credential validation failed:", error);
                    showNotification('验证失败', '无法验证凭证: ' + error.message, 'error', 0); // Show error indefinitely
                    // Clear potentially invalid stored credentials if validation fails
                    clearCredentials();
                    showElement(apiSetupDiv);
                    hideElement(domainManagementDiv);
                    hideElement(userInfoDiv);
                    hideElement(domainLoadingRow);
                    showElement(domainNoResultsRow); // Show "no results" as validation failed
                } finally {
                    hideLoading();
                }
            }

            saveApiButton.addEventListener('click', () => {
                const key = apiKeyInput.value.trim();
                const email = emailInput.value.trim();
                // Simple heuristic: Tokens are usually long and don't need email. Keys are shorter (~37 chars) and need email.
                // This isn't foolproof but a decent guess. Global API Keys are exactly 37 chars.
                const looksLikeApiKey = key.length === 37; // Global API Key length

                if (!key) {
                    showNotification('错误', '请输入 API Key 或 API Token。', 'error');
                    return;
                }
                // If it looks like a Key, email is required (unless using proxy that handles it)
                if (looksLikeApiKey && !email && !PROXY_ENABLED) {
                    showNotification('错误', '使用 Global API Key 时必须提供 Email。', 'error');
                    return;
                }
                // Basic email format check if provided
                if (email && !/\S+@\S+\.\S+/.test(email)) {
                    showNotification('错误', '请输入有效的 Email 地址。', 'error');
                    return;
                }

                // Store temporarily for validation attempt
                currentApiAuth = { key, email: email || null }; // Store null email if empty (implies token or proxy handles email)

                // Validate and proceed
                validateCredentialsAndLoadDomains(true).then(() => {
                    // Only save to sessionStorage AFTER successful validation
                    sessionStorage.setItem('cfApiKey', currentApiAuth.key);
                    if (currentApiAuth.email) {
                        sessionStorage.setItem('cfEmail', currentApiAuth.email);
                    } else {
                        sessionStorage.removeItem('cfEmail'); // Ensure email is removed if using token or it's empty
                    }
                }).catch((validationError) => {
                    // Error is already handled and shown by validateCredentialsAndLoadDomains
                    // Clear the temporary auth state as validation failed
                    currentApiAuth = { key: null, email: null };
                    currentAccountId = null;
                    // Do NOT save to session storage on failure
                });
            });

            function clearCredentials() {
                sessionStorage.removeItem('cfApiKey');
                sessionStorage.removeItem('cfEmail');
                currentApiAuth = { key: null, email: null };
                currentAccountId = null;
                apiKeyInput.value = '';
                emailInput.value = '';
                // Also reset UI state
                hideElement(domainManagementDiv);
                hideElement(userInfoDiv);
                showElement(apiSetupDiv);
                domainListBody.innerHTML = ''; // Clear domain list table
            }

            logoutButton.addEventListener('click', () => {
                showConfirmation('退出登录', '您确定要清除保存的凭证并退出吗？应用程序状态将重置。', () => {
                    clearCredentials();
                    hideModal(confirmModal);
                    showNotification('已退出', 'API 凭证已清除。请重新输入以继续。', 'info');
                }, 'warning');
            });

            togglePasswordButton.addEventListener('click', () => {
                const isPassword = apiKeyInput.type === 'password';
                apiKeyInput.type = isPassword ? 'text' : 'password';
                togglePasswordIcon.classList.toggle('fa-eye', !isPassword);
                togglePasswordIcon.classList.toggle('fa-eye-slash', isPassword);
            });


            // --- Domain List Logic ---

            async function fetchAndRenderDomains() {
                showElement(domainLoadingRow);
                hideElement(domainNoResultsRow);
                hideElement(domainErrorRow);
                domainListBody.innerHTML = ''; // Clear previous list

                try {
                    // Fetch all zones (consider pagination for large accounts)
                    // Example: const response = await cloudflareApiRequest('/zones?per_page=50');
                    const response = await cloudflareApiRequest('/zones');
                    domainListData = response.result || []; // Store the raw data
                    renderDomainList(); // Render based on stored data and filters
                } catch (error) {
                    console.error("Error fetching domains:", error);
                    showNotification('错误', '加载域名列表失败: ' + error.message, 'error', 0);
                    domainListBody.innerHTML = ''; // Clear loading row
                    showElement(domainErrorRow);
                } finally {
                    hideElement(domainLoadingRow);
                }
            }

            function renderDomainList() {
                domainListBody.innerHTML = ''; // Clear existing rows first
                const searchTerm = searchDomainInput.value.toLowerCase().trim();
                let hasResults = false;

                const filteredData = domainListData.filter(zone => {
                    if (!zone || !zone.name) return false; // Basic data integrity check
                    const matchesSearch = !searchTerm || zone.name.toLowerCase().includes(searchTerm);
                    const matchesFilter = activeDomainFilter === 'all' || zone.status === activeDomainFilter;
                    return matchesSearch && matchesFilter;
                });

                if (filteredData.length === 0) {
                    showElement(domainNoResultsRow);
                    domainNoResultsRow.textContent = searchTerm ? '没有匹配 "' + searchTerm + '" 的域名。' : '未找到域名或凭据无效。';
                    return; // Stop processing if no results
                } else {
                    hideElement(domainNoResultsRow);
                }

                filteredData.forEach(zone => {
                    const row = document.createElement('tr');
                    row.className = 'domain-row hover:bg-gray-50 transition duration-150 ease-in-out';
                    row.dataset.zoneId = zone.id;
                    row.dataset.zoneName = zone.name;
                    row.dataset.zoneStatus = zone.status;

                    // Status Badge Mapping
                    let statusBadgeClass = 'bg-gray-100 text-gray-800';
                    let statusIcon = 'fa-solid fa-question-circle text-gray-500'; // Default icon
                    switch (zone.status) {
                        case 'active':
                            statusBadgeClass = 'bg-green-100 text-green-800';
                            statusIcon = 'fa-solid fa-check-circle text-green-500';
                            break;
                        case 'pending':
                            statusBadgeClass = 'bg-yellow-100 text-yellow-800';
                            statusIcon = 'fa-solid fa-hourglass-half text-yellow-500';
                            break;
                        case 'initializing':
                            statusBadgeClass = 'bg-blue-100 text-blue-800';
                            statusIcon = 'fa-solid fa-spinner fa-spin text-blue-500'; // Use spin icon
                            break;
                        case 'moved':
                            statusBadgeClass = 'bg-orange-100 text-orange-800';
                            statusIcon = 'fa-solid fa-arrow-right-to-bracket text-orange-500';
                            break;
                        case 'deleted':
                        case 'deactivated':
                            statusBadgeClass = 'bg-red-100 text-red-800';
                            statusIcon = 'fa-solid fa-times-circle text-red-500';
                            break;
                    }

                    // Build innerHTML using string concatenation
                    row.innerHTML =
                        '<td class="px-6 py-4 whitespace-nowrap">' +
                        '<div class="flex items-center">' +
                        '<i class="' + statusIcon + ' mr-2 text-lg" title="' + zone.status + '"></i>' + // Add title to icon
                        '<span class="font-medium text-gray-900">' + zone.name + '</span>' +
                        '</div>' +
                        '</td>' +
                        '<td class="px-6 py-4 whitespace-nowrap">' +
                        '<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ' + statusBadgeClass + '">' +
                        zone.status +
                        '</span>' +
                        '</td>' +
                        '<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">' + (zone.plan?.name || 'N/A') + '</td>' +
                        '<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">' +
                        '<div class="truncate max-w-xs" title="' + (zone.name_servers || []).join(', ') + '">' +
                        (zone.name_servers && zone.name_servers.length > 0 ? zone.name_servers.join(', ') : 'N/A') + // Handle empty array
                        '</div>' +
                        '</td>' +
                        '<td class="px-6 py-4 whitespace-nowrap text-sm font-medium">' +
                        '<div class="flex space-x-3">' + // Increased space
                        '<button class="manage-records-btn text-blue-600 hover:text-blue-900 transition duration-150 ease-in-out" title="管理 DNS 记录">' +
                        '<i class="fa-solid fa-list-ul"></i>' + // Changed icon
                        '</button>' +
                        '<button class="delete-domain-btn text-red-600 hover:text-red-900 transition duration-150 ease-in-out" title="删除域名">' +
                        '<i class="fa-solid fa-trash-can"></i>' + // Changed icon
                        '</button>' +
                        '<!-- Add more actions here -->' +
                        '</div>' +
                        '</td>';

                    domainListBody.appendChild(row);
                    addDomainRowEventListeners(row); // Attach listeners AFTER appending
                });
            }

            searchDomainInput.addEventListener('input', renderDomainList); // Filter dynamically on input

            filterButtons.forEach(button => {
                button.addEventListener('click', () => {
                    filterButtons.forEach(btn => {
                        btn.classList.remove('active', 'bg-blue-500', 'text-white');
                        btn.classList.add('bg-gray-200', 'hover:bg-gray-300'); // Reset others to default gray
                    });
                    button.classList.add('active', 'bg-blue-500', 'text-white'); // Activate clicked button
                    button.classList.remove('bg-gray-200', 'hover:bg-gray-300');
                    activeDomainFilter = button.dataset.filter;
                    renderDomainList(); // Re-render the list with the new filter
                });
            });

            refreshListButton.addEventListener('click', async () => {
                showNotification('刷新中', '正在重新加载域名列表...', 'info', 2000);
                searchDomainInput.value = ''; // Clear search on refresh
                // Reset filter to 'all' visually and functionally
                filterButtons.forEach(btn => {
                    btn.classList.remove('active', 'bg-blue-500', 'text-white');
                    btn.classList.add('bg-gray-200', 'hover:bg-gray-300');
                    if (btn.dataset.filter === 'all') {
                        btn.classList.add('active', 'bg-blue-500', 'text-white');
                        btn.classList.remove('bg-gray-200', 'hover:bg-gray-300');
                    }
                });
                activeDomainFilter = 'all';
                await fetchAndRenderDomains(); // Fetch fresh data from API
                showNotification('刷新完成', '域名列表已更新。', 'success', 2000);
            });

            // Attach listeners to buttons within each dynamically created domain row
            function addDomainRowEventListeners(row) {
                const zoneId = row.dataset.zoneId;
                const zoneName = row.dataset.zoneName;

                const manageBtn = row.querySelector('.manage-records-btn');
                if (manageBtn) {
                    manageBtn.addEventListener('click', () => {
                        openDnsModal(zoneId, zoneName);
                    });
                }

                const deleteBtn = row.querySelector('.delete-domain-btn');
                if (deleteBtn) {
                    deleteBtn.addEventListener('click', () => {
                        // return showNotification("按钮未绑定","删除域名按钮未绑定事件。", "error", 0); // Removed placeholder
                        showConfirmation(
                            '确认删除域名',
                            '您确定要从 Cloudflare 账户中永久删除域名 "' + zoneName + '" 及其所有 DNS 记录和配置吗？此操作无法撤销！', // No backticks
                            async () => {
                                showLoading(false); // Show local loading indicator over table maybe?
                                proceedConfirmButton.disabled = true; // Prevent double clicks
                                cancelConfirmButton.disabled = true;
                                try {
                                    // Make the DELETE request
                                    await cloudflareApiRequest('/zones/' + zoneId, 'DELETE'); // No backticks
                                    hideModal(confirmModal);
                                    showNotification('已删除', '域名 "' + zoneName + '" 已成功删除。', 'success'); // No backticks
                                    // Remove the domain from local data and re-render the list
                                    domainListData = domainListData.filter(zone => zone.id !== zoneId);
                                    renderDomainList(); // Update the UI
                                } catch (error) {
                                    showNotification('删除失败', '删除域名 "' + zoneName + '" 时出错: ' + error.message, 'error', 0); // No backticks
                                    // Optionally hide confirm modal even on error, or keep it for context
                                    hideModal(confirmModal); // Hide confirm modal on error too
                                } finally {
                                    hideLoading();
                                    // Re-enable confirm buttons if the modal wasn't hidden or might be reused
                                    proceedConfirmButton.disabled = false;
                                    cancelConfirmButton.disabled = false;
                                }
                            },
                            'danger' // Use danger styling for deletion confirmation
                        );
                    });
                }
            }

            // --- Add Domain Modal Logic ---
            addDomainButton.addEventListener('click', () => {
                if (!currentAccountId && !PROXY_ENABLED) { // Account ID is crucial for adding zones directly
                    showNotification('需要账户 ID', '无法自动确定 Cloudflare 账户 ID。请确保 API 凭证有效或配置了代理。添加域名功能可能受限。', 'warning', 6000);
                    // Optionally, attempt to fetch it again here if needed.
                    // return; // Prevent opening modal if account ID is strictly needed and absent
                }
                domainForm.reset(); // Clear previous input
                showModal(domainFormModal);
                domainNameInput.focus(); // Focus the input field
            });

            closeDomainFormButton.addEventListener('click', () => hideModal(domainFormModal));
            cancelDomainButton.addEventListener('click', () => hideModal(domainFormModal));

            domainForm.addEventListener('submit', async (e) => {
                e.preventDefault(); // Prevent standard form submission
                const newDomain = domainNameInput.value.trim().toLowerCase(); // Normalize domain input
                if (!newDomain) {
                    showNotification('错误', '请输入有效的域名。', 'error');
                    return;
                }
                // Validate domain format (simple check)
                // This regex is basic, real validation is more complex
                if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(newDomain) || newDomain.startsWith('.') || newDomain.endsWith('.')) {
                    showNotification('错误', '域名格式无效。请输入类似 "example.com" 的格式。', 'error');
                    return;
                }

                // Account ID is required by the API unless handled by proxy
                if (!currentAccountId && !PROXY_ENABLED) {
                    showNotification('无法添加', '缺少账户 ID，无法添加域名。请确保初始凭证验证成功或配置代理。', 'error', 6000);
                    return;
                }

                addDomainSubmitBtn.disabled = true;
                addDomainSubmitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>添加中...';

                try {
                    const payload = {
                        name: newDomain,
                        // Account ID is required by Cloudflare API
                        account: { id: currentAccountId },
                        // type: 'full' // Default is 'full', 'partial' for CNAME setup (not used here)
                    };
                    const response = await cloudflareApiRequest('/zones', 'POST', payload);

                    hideModal(domainFormModal);
                    // Make sure response.result and name exist
                    const addedDomainName = response.result?.name || newDomain;
                    showNotification('成功', '域名 "' + addedDomainName + '" 已成功添加。请更新您的域名注册商处的名称服务器。', 'success', 7000);

                    // Add the new domain to local data and re-render the list immediately
                    if (response.result) {
                        domainListData.push(response.result);
                        // Sort list alphabetically after adding? Optional.
                        // domainListData.sort((a, b) => a.name.localeCompare(b.name));
                        renderDomainList(); // Update the UI
                    } else {
                        // If result wasn't returned, refresh the whole list just in case
                        fetchAndRenderDomains();
                    }

                } catch (error) {
                    showNotification('添加失败', '添加域名 "' + newDomain + '" 时出错: ' + error.message, 'error', 0); // Show error indefinitely
                } finally {
                    addDomainSubmitBtn.disabled = false;
                    addDomainSubmitBtn.innerHTML = '添加域名';
                }
            });

            // --- DNS Records Modal Logic ---
            async function openDnsModal(zoneId, zoneName) {
                dnsModalDomainTitle.textContent = zoneName;
                currentZoneIdInput.value = zoneId; // Store zone ID for the record form
                currentZoneNameInput.value = zoneName; // Store zone Name for the record form
                dnsRecordsBody.innerHTML = ''; // Clear previous records
                hideElement(dnsNoRecordsRow);
                hideElement(dnsErrorRow);
                showDnsLoading();
                showModal(dnsModal);

                try {
                    // Fetch DNS records for the specific zone
                    // Consider adding pagination support here if needed (?per_page=100)
                    const response = await cloudflareApiRequest('/zones/' + zoneId + '/dns_records'); // No backticks
                    const records = response.result || [];
                    renderDnsRecords(records, zoneName, zoneId); // Pass zoneId along
                } catch (error) {
                    console.error('Error fetching DNS records for ' + zoneName + ':', error); // No backticks
                    showNotification('错误', '加载 DNS 记录失败: ' + error.message, 'error', 0); // No backticks
                    showElement(dnsErrorRow);
                } finally {
                    hideDnsLoading();
                }
            }

            function renderDnsRecords(records, zoneName, zoneId) {
                dnsRecordsBody.innerHTML = ''; // Clear existing table body
                if (records.length === 0) {
                    showElement(dnsNoRecordsRow);
                    return;
                }
                hideElement(dnsNoRecordsRow);

                // Sort records perhaps? By type then name? (Optional)
                records.sort((a, b) => {
                    if (a.type !== b.type) return a.type.localeCompare(b.type);
                    return a.name.localeCompare(b.name);
                });


                records.forEach(record => {
                    const row = document.createElement('tr');
                    row.className = 'dns-record-row hover:bg-gray-50 transition duration-150 ease-in-out';
                    row.dataset.recordId = record.id;
                    row.dataset.zoneId = zoneId; // Store zoneId on the row
                    record.zone_id = zoneId; // Store zoneId in record data for API calls
                    // Store the full record data as a JSON string for easy access in edit/delete
                    row.dataset.recordData = JSON.stringify(record);

                    const typeClass = getRecordTypeClass(record.type);
                    const ttlText = record.ttl === 1 ? '自动' : record.ttl + ' 秒'; // No backticks

                    // Display full name (hostname), but store the relative name (@ for root) in data attribute if needed for API calls
                    // const displayName = record.name === zoneName ? '@ (' + zoneName + ')' : record.name;
                    const displayName = record.name; // Keep it simple, show full name
                    const apiName = record.name === zoneName ? '@' : record.name.replace('.' + zoneName, ''); // Used for form population

                    // Handle complex content display (e.g., SRV, CAA)
                    let contentDisplay = record.content;
                    if (record.type === 'MX' && record.priority !== undefined) {
                        contentDisplay = record.content + ' (优先级: ' + record.priority + ')';
                    } else if (record.type === 'SRV' && record.data) { // SRV data is often in a nested 'data' object
                        contentDisplay = '服务: ' + record.data.service + ', 协议: ' + record.data.proto +
                            ', 优先级: ' + record.data.priority + ', 权重: ' + record.data.weight +
                            ', 端口: ' + record.data.port + ', 目标: ' + record.data.target;
                    } else if (record.type === 'CAA' && record.data) {
                        contentDisplay = '标记: ' + record.data.flags + ', 标签: ' + record.data.tag + ', 值: ' + record.data.value;
                    }

                    row.innerHTML =
                        '<td class="px-6 py-4 whitespace-nowrap">' +
                        '<span class="record-type px-2 py-1 rounded text-xs font-medium ' + typeClass + '">' + record.type + '</span>' +
                        '</td>' +
                        '<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 record-name" title="' + record.name + '">' + displayName + '</td>' +
                        '<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600 record-content truncate max-w-xs" title="' + contentDisplay + '">' + contentDisplay + '</td>' + // Use contentDisplay
                        '<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 record-ttl" data-ttl-value="' + record.ttl + '">' + ttlText + '</td>' +
                        '<td class="px-6 py-4 whitespace-nowrap record-proxied" data-proxied="' + record.proxied + '">' +
                        '<span class="flex items-center">' +
                        '<span class="h-3 w-3 rounded-full mr-2 ' + (record.proxied ? 'bg-orange-400' : 'bg-gray-400') + '"></span>' + // Conditional class
                        '<span class="text-sm">' + (record.proxied ? '已代理' : '仅 DNS') + '</span>' + // Conditional text
                        '</span>' +
                        '</td>' +
                        '<td class="px-6 py-4 whitespace-nowrap text-sm font-medium">' +
                        '<div class="flex space-x-3">' + // Increased space
                        '<button class="edit-record-btn text-blue-600 hover:text-blue-900 transition duration-150 ease-in-out" title="编辑记录">' +
                        '<i class="fa-solid fa-pencil-alt"></i>' + // Changed icon
                        '</button>' +
                        '<button class="delete-record-btn text-red-600 hover:text-red-900 transition duration-150 ease-in-out" title="删除记录">' +
                        '<i class="fa-solid fa-trash-can"></i>' + // Changed icon
                        '</button>' +
                        '</div>' +
                        '</td>';

                    dnsRecordsBody.appendChild(row);
                    addDnsRecordEventListeners(row); // Attach listeners after appending
                });
            }

            // Add listeners to DNS record row buttons
            function addDnsRecordEventListeners(row) {
                const recordId = row.dataset.recordId;
                const zoneId = row.dataset.zoneId; // Get zoneId from the row's dataset

                // Safely parse JSON data, handle potential errors
                let recordData;
                try {
                    recordData = JSON.parse(row.dataset.recordData);
                } catch (e) {
                    console.error("Failed to parse record data for row:", row, e);
                    showNotification('错误', '无法处理此记录的数据。', 'error');
                    return; // Stop if data is corrupted
                }

                const editBtn = row.querySelector('.edit-record-btn');
                if (editBtn) {
                    editBtn.addEventListener('click', () => {
                        populateRecordForm(recordData, zoneId); // Pass zoneId explicitly if needed
                    });
                }

                const deleteBtn = row.querySelector('.delete-record-btn');
                if (deleteBtn) {
                    deleteBtn.addEventListener('click', () => {
                        // Construct confirmation message
                        const recordIdentifier = recordData.type + ' 记录 "' + recordData.name + '"';
                        showConfirmation(
                            '确认删除 DNS 记录',
                            '您确定要永久删除 ' + recordIdentifier + ' 吗？此操作无法撤销。', // No backticks
                            async () => {
                                showDnsLoading(); // Show loading indicator within the DNS modal
                                proceedConfirmButton.disabled = true; // Prevent double clicks
                                cancelConfirmButton.disabled = true;
                                try {
                                    // API requires Zone ID and Record ID
                                    await cloudflareApiRequest('/zones/' + recordData.zone_id + '/dns_records/' + recordId, 'DELETE'); // No backticks
                                    hideModal(confirmModal);
                                    showNotification('已删除', 'DNS 记录 "' + recordData.name + '" 已删除。', 'success'); // No backticks
                                    row.remove(); // Remove the row directly from the table

                                    // Check if this was the last record
                                    if (dnsRecordsBody.querySelectorAll('.dns-record-row').length === 0) {
                                        showElement(dnsNoRecordsRow);
                                    }
                                } catch (error) {
                                    showNotification('删除失败', '删除 DNS 记录时出错: ' + error.message, 'error', 0); // No backticks
                                    hideModal(confirmModal); // Hide confirm modal on error too
                                } finally {
                                    hideDnsLoading();
                                    // Re-enable confirm buttons
                                    proceedConfirmButton.disabled = false;
                                    cancelConfirmButton.disabled = false;
                                }
                            },
                            'danger' // Use danger styling
                        );
                    });
                }
            }

            closeDnsModalButton.addEventListener('click', () => hideModal(dnsModal));
            closeDnsModalFooterButton.addEventListener('click', () => hideModal(dnsModal));


            // --- Add/Edit DNS Record Form Logic ---

            addRecordButton.addEventListener('click', () => {
                const zoneName = currentZoneNameInput.value; // Get from hidden input
                recordFormTitle.textContent = '添加 DNS 记录到 ' + zoneName; // No backticks
                dnsRecordForm.reset(); // Clear form fields
                recordIdInput.value = ''; // Ensure no record ID is set for adding
                // currentZoneIdInput value should already be set when DNS modal opened
                updateRecordFormUI('A'); // Reset form UI to default type 'A'
                proxyStatusCheckbox.checked = false; // Default proxy to off
                recordTtlSelect.value = '1'; // Default TTL to Auto
                showModal(recordFormModal);
                recordTypeSelect.focus(); // Focus the first input
            });

            closeRecordFormButton.addEventListener('click', () => hideModal(recordFormModal));
            cancelRecordButton.addEventListener('click', () => hideModal(recordFormModal));

            // Populate the form when editing an existing record
            function populateRecordForm(record, zoneId) { // zoneId passed for clarity
                const zoneName = record.zone_name || currentZoneNameInput.value; // Get zone name from record data or fallback
                recordFormTitle.textContent = '编辑 ' + record.type + ' 记录 (' + zoneName + ')'; // No backticks
                dnsRecordForm.reset(); // Start clean

                recordIdInput.value = record.id;
                currentZoneIdInput.value = record.zone_id || zoneId; // Ensure zone ID is set
                currentZoneNameInput.value = zoneName; // Update zone name just in case

                recordTypeSelect.value = record.type;
                // Convert full domain name back to relative name ('@' or subdomain part) for the input field
                const apiName = record.name === zoneName ? '@' : record.name.replace('.' + zoneName, ''); // No backticks
                recordNameInput.value = apiName;

                recordTtlSelect.value = record.ttl.toString(); // TTL is stored directly
                proxyStatusCheckbox.checked = record.proxied || false; // Default to false if undefined

                // Set the correct content field based on type and fill it
                updateRecordFormUI(record.type); // Show/hide correct fields first

                // Populate content fields based on type
                if (record.type === 'A' || record.type === 'AAAA' || record.type === 'CNAME' || record.type === 'NS' || record.type === 'PTR') {
                    document.getElementById('record-content-' + record.type).value = record.content;
                } else if (record.type === 'MX') {
                    document.getElementById('record-content-MX').value = record.content;
                    mxPriorityInput.value = record.priority !== undefined ? record.priority : 10; // Default priority if missing?
                } else if (record.type === 'TXT') {
                    document.getElementById('record-content-TXT').value = record.content;
                } else if (record.type === 'SRV' && record.data) {
                    srvServiceInput.value = record.data.service || '';
                    srvProtoSelect.value = record.data.proto || '_tcp';
                    srvPriorityInput.value = record.data.priority !== undefined ? record.data.priority : 10;
                    srvWeightInput.value = record.data.weight !== undefined ? record.data.weight : 5;
                    srvPortInput.value = record.data.port || '';
                    srvTargetInput.value = record.data.target || '';
                } else if (record.type === 'CAA' && record.data) {
                    caaFlagsInput.value = record.data.flags !== undefined ? record.data.flags : 0;
                    caaTagSelect.value = record.data.tag || 'issue';
                    caaValueInput.value = record.data.value || '';
                } else {
                    // Fallback for generic or types not explicitly handled
                    document.getElementById('record-content-generic').value = record.content;
                }

                showModal(recordFormModal);
            }


            // Update visible content fields and proxy toggle based on selected record type
            function updateRecordFormUI(recordType) {
                // Hide all type-specific content field containers first
                document.querySelectorAll('[id^="content-field-"]').forEach(el => hideElement(el));

                // Show the relevant content field container
                let contentFieldContainerId = 'content-field-' + recordType; // No backticks
                let contentFieldContainer = document.getElementById(contentFieldContainerId);

                if (!contentFieldContainer) {
                    contentFieldContainer = document.getElementById('content-field-generic'); // Use generic if specific doesn't exist
                }
                showElement(contentFieldContainer);

                // Enable/disable proxy toggle based on type
                const canProxy = ['A', 'AAAA', 'CNAME'].includes(recordType);
                proxyToggleContainer.style.display = canProxy ? 'flex' : 'none'; // Show/hide the whole proxy section
                proxyStatusCheckbox.disabled = !canProxy;
                if (!canProxy) {
                    proxyStatusCheckbox.checked = false; // Force proxy off for incompatible types
                }
            }

            // Update form UI when record type changes
            recordTypeSelect.addEventListener('change', (e) => {
                updateRecordFormUI(e.target.value);
                // Clear content fields when type changes? Optional, maybe annoying.
                // recordContentInputs.forEach(input => input.value = '');
                // mxPriorityInput.value = ''; // Clear specific fields too
            });

            // Handle form submission (for both Add and Edit)
            dnsRecordForm.addEventListener('submit', async (e) => {
                e.preventDefault(); // Prevent default submission
                const recordId = recordIdInput.value; // Empty string if adding, ID if editing
                const zoneId = currentZoneIdInput.value;
                const zoneName = currentZoneNameInput.value; // Needed for name processing
                const isEditing = !!recordId;
                const recordType = recordTypeSelect.value;

                // --- Construct the payload based on type ---
                const payload = {
                    type: recordType,
                    ttl: parseInt(recordTtlSelect.value, 10),
                    proxied: proxyStatusCheckbox.disabled ? undefined : proxyStatusCheckbox.checked, // Only include proxied if applicable
                };

                // 1. Process Name: Convert '@' or relative name to full DNS name
                let nameInput = recordNameInput.value.trim();
                payload.name = (nameInput === '@' || nameInput === '') ? zoneName : nameInput + '.' + zoneName; // No backticks

                // 2. Process Content / Data based on type
                let validationPassed = true;
                try {
                    if (recordType === 'A' || recordType === 'AAAA' || recordType === 'CNAME' || recordType === 'NS' || recordType === 'PTR') {
                        payload.content = document.getElementById('record-content-' + recordType).value.trim();
                        if (!payload.content) throw new Error("Content cannot be empty.");
                    } else if (recordType === 'MX') {
                        payload.content = document.getElementById('record-content-MX').value.trim();
                        payload.priority = parseInt(mxPriorityInput.value, 10);
                        if (!payload.content) throw new Error("MX server content cannot be empty.");
                        if (isNaN(payload.priority) || payload.priority < 0) throw new Error("MX requires a valid non-negative Priority.");
                    } else if (recordType === 'TXT') {
                        payload.content = document.getElementById('record-content-TXT').value.trim(); // Allow empty TXT? Cloudflare might allow it. Check API docs if strict.
                        if (payload.content === null || payload.content === undefined) throw new Error("TXT content is required."); // Ensure it's at least an empty string if needed
                    } else if (recordType === 'SRV') {
                        // SRV uses the 'data' object, not 'content'
                        const service = srvServiceInput.value.trim();
                        const proto = srvProtoSelect.value;
                        const priority = parseInt(srvPriorityInput.value, 10);
                        const weight = parseInt(srvWeightInput.value, 10);
                        const port = parseInt(srvPortInput.value, 10);
                        const target = srvTargetInput.value.trim();

                        if (!service || !proto || isNaN(priority) || isNaN(weight) || isNaN(port) || !target ||
                            priority < 0 || weight < 0 || port < 1 || port > 65535) {
                            throw new Error("SRV record requires valid Service, Proto, Priority, Weight, Port, and Target.");
                        }
                        payload.data = { service, proto, priority, weight, port, target };
                        // Cloudflare API also expects name to include service and proto for SRV: _service._proto.name
                        payload.name = service + '.' + proto + '.' + (nameInput === '@' || nameInput === '' ? zoneName : nameInput + '.' + zoneName);
                        // Content field is not used for SRV when using 'data'
                        delete payload.content;

                    } else if (recordType === 'CAA') {
                        // CAA also uses 'data'
                        const flags = parseInt(caaFlagsInput.value, 10);
                        const tag = caaTagSelect.value;
                        const value = caaValueInput.value.trim();
                        if (isNaN(flags) || flags < 0 || flags > 255 || !tag || !value) {
                            throw new Error("CAA record requires valid Flags (0-255), Tag, and Value.");
                        }
                        payload.data = { flags, tag, value };
                        delete payload.content;
                    } else {
                        // Fallback for generic types
                        payload.content = document.getElementById('record-content-generic').value.trim();
                        if (!payload.content) throw new Error("Content cannot be empty for this record type.");
                    }
                } catch (validationError) {
                    showNotification('验证错误', validationError.message, 'error');
                    validationPassed = false;
                }

                if (!validationPassed) {
                    return; // Stop if validation failed
                }


                // --- Perform API Call ---
                saveRecordBtn.disabled = true;
                saveRecordBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>' + (isEditing ? '更新中' : '添加中') + '...'; // No backticks

                try {
                    let response;
                    const endpoint = '/zones/' + zoneId + '/dns_records'; // No backticks
                    if (isEditing) {
                        // Use PUT to update the record fully
                        response = await cloudflareApiRequest(endpoint + '/' + recordId, 'PUT', payload); // No backticks
                        showNotification('成功', 'DNS 记录 "' + response.result.name + '" 已更新。', 'success'); // No backticks
                    } else {
                        // Use POST to create a new record
                        response = await cloudflareApiRequest(endpoint, 'POST', payload);
                        showNotification('成功', 'DNS 记录 "' + response.result.name + '" 已添加。', 'success'); // No backticks
                    }

                    hideModal(recordFormModal);
                    // Refresh the DNS list in the background DNS modal to show the change/addition
                    openDnsModal(zoneId, zoneName); // Re-fetch and render records

                } catch (error) {
                    showNotification('保存失败', '保存 DNS 记录时出错: ' + error.message, 'error', 0); // No backticks
                } finally {
                    saveRecordBtn.disabled = false;
                    saveRecordBtn.innerHTML = '保存记录';
                }
            });


            // --- Confirmation Modal Logic ---
            cancelConfirmButton.addEventListener('click', () => {
                hideModal(confirmModal);
                currentConfirmCallback = null; // Reset callback
            });

            proceedConfirmButton.addEventListener('click', () => {
                if (typeof currentConfirmCallback === 'function') {
                    // Disable buttons immediately inside the callback call if needed
                    proceedConfirmButton.disabled = true;
                    cancelConfirmButton.disabled = true;
                    currentConfirmCallback(); // Execute the stored action (delete domain/record etc.)
                    // The callback itself should handle re-enabling or hiding the modal
                }
                // Reset callback AFTER execution attempt (or within the callback)
                // currentConfirmCallback = null;
            });

            // --- Notification Logic ---
            closeNotificationButton.addEventListener('click', hideNotification);

            // --- Helper: Get CSS Class for Record Type Badge ---
            function getRecordTypeClass(type) {
                // Consistent color mapping for badges
                const typeClasses = {
                    'A': 'bg-blue-100 text-blue-800', 'AAAA': 'bg-sky-100 text-sky-800',
                    'CNAME': 'bg-purple-100 text-purple-800', 'MX': 'bg-pink-100 text-pink-800',
                    'TXT': 'bg-gray-100 text-gray-800', 'NS': 'bg-indigo-100 text-indigo-800',
                    'SRV': 'bg-teal-100 text-teal-800', 'CAA': 'bg-red-100 text-red-800',
                    'PTR': 'bg-orange-100 text-orange-800', 'SPF': 'bg-lime-100 text-lime-800', // Note: SPF is often TXT
                    'CERT': 'bg-cyan-100 text-cyan-800', 'DNSKEY': 'bg-fuchsia-100 text-fuchsia-800',
                    'DS': 'bg-rose-100 text-rose-800', 'NAPTR': 'bg-violet-100 text-violet-800',
                    'SMIMEA': 'bg-emerald-100 text-emerald-800', 'SSHFP': 'bg-amber-100 text-amber-800',
                    'TLSA': 'bg-yellow-100 text-yellow-800', 'URI': 'bg-green-100 text-green-800'
                };
                return typeClasses[type.toUpperCase()] || 'bg-gray-100 text-gray-800'; // Default fallback
            }


            // --- Global Event Listeners (e.g., closing modals on ESC) ---
            window.addEventListener('keydown', (event) => {
                if (event.key === 'Escape') {
                    // Close the topmost open modal
                    if (!confirmModal.classList.contains('hidden')) {
                        hideModal(confirmModal);
                    } else if (!recordFormModal.classList.contains('hidden')) {
                        hideModal(recordFormModal);
                    } else if (!dnsModal.classList.contains('hidden')) {
                        hideModal(dnsModal);
                    } else if (!domainFormModal.classList.contains('hidden')) {
                        hideModal(domainFormModal);
                    }
                }
            });

            if (copyrightYearSpan) {
                copyrightYearSpan.textContent = new Date().getFullYear();
            }

            // --- Init ---
            loadAndValidateCredentials(); // Check session storage and validate on page load

        });
    </script>
</body>

</html>
`;

// --- 路由1：返回嵌入的静态页面 ---
app.get('/', (c) => {
    console.log('正在处理根路径请求');
    return c.html(staticPageContent); // 使用 c.html() 设置正确 Content-Type
});

app.use('*', cors({
  origin: '*', // IMPORTANT: For development, '*' is okay. For production, restrict this to your frontend's actual domain(s) e.g., ['https://yourdomain.com', 'http://localhost:3000']
  allowHeaders: ['Content-Type', 'Authorization', 'X-Auth-Email', 'X-Auth-Key'], // Add any custom headers your frontend sends
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Methods your frontend uses
  // maxAge: 600, // Optional: How long the result of a preflight request can be cached
  // credentials: true, // Optional: Set to true if you need to pass cookies or Authorization headers with credentials
}));
// --- 路由2：代理其他请求至 Cloudflare API ---
app.all('*', async (c) => {
    const targetBaseUrl = 'https://api.cloudflare.com';
    const url = new URL(c.req.url);
    const targetUrl = targetBaseUrl + url.pathname + url.search;
    console.log(`代理请求: ${c.req.method} ${url.pathname}${url.search} -> ${targetUrl}`);

    const headers = {
      "Authorization": c.req.header('Authorization'),
      "User-Agent": c.req.header('User-Agent'),
    };
    const body = await c.req.text();
    console.log(`代理请求体: ${body}`);
    console.log(`代理请求头: ${JSON.stringify(headers)}`);
    try {
        const response = await fetch(targetUrl, {
            method: c.req.method,
            headers: headers,
            body: body?body: undefined,
        });
        console.log(`代理响应状态码: ${response.status}`);
        return response;
    } catch (error) {
        console.error('代理错误:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return c.text(`代理失败: ${errorMessage}`, 502);
    }
});

export default app;
