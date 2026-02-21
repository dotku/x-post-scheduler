import Link from "next/link";

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Documentation
            </h1>
            <Link
              href="/"
              className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Intro */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            How to Get X API Keys
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            如何获取 X (Twitter) API 密钥
          </p>
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            To post to X through this app, you need 4 API credentials from the
            X Developer Portal. Follow the steps below to obtain them.
          </p>
          <p className="mt-1 text-gray-600 dark:text-gray-400">
            要通过本应用发布推文，你需要从 X 开发者平台获取 4 个 API 密钥。请按以下步骤操作。
          </p>
        </div>

        {/* Step 1 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-start gap-4">
            <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-blue-600 text-white font-bold text-sm">
              1
            </span>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Create an X Developer Account
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                注册 X 开发者账号
              </p>
              <ol className="list-decimal list-inside space-y-2 text-gray-600 dark:text-gray-400 text-sm">
                <li>
                  Visit{" "}
                  <a
                    href="https://developer.x.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 underline"
                  >
                    developer.x.com
                  </a>{" "}
                  and sign in with your X account.
                  <br />
                  <span className="text-gray-500 dark:text-gray-500">
                    访问 developer.x.com 并用你的 X 账号登录。
                  </span>
                </li>
                <li>
                  If you haven&apos;t already, apply for a Developer account. The free
                  tier is sufficient.
                  <br />
                  <span className="text-gray-500 dark:text-gray-500">
                    如果还没有开发者账号，申请一个即可。免费套餐就够用了。
                  </span>
                </li>
                <li>
                  Complete the application form describing your use case (e.g.,
                  &ldquo;scheduling and posting tweets for my personal
                  account&rdquo;).
                  <br />
                  <span className="text-gray-500 dark:text-gray-500">
                    填写申请表，描述你的用途（如"为个人账号定时发推"）。
                  </span>
                </li>
              </ol>
            </div>
          </div>
        </div>

        {/* Step 2 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-start gap-4">
            <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-blue-600 text-white font-bold text-sm">
              2
            </span>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Create a Project & App
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                创建项目和应用
              </p>
              <ol className="list-decimal list-inside space-y-2 text-gray-600 dark:text-gray-400 text-sm">
                <li>
                  In the Developer Portal, go to{" "}
                  <strong>Projects & Apps</strong>.
                  <br />
                  <span className="text-gray-500 dark:text-gray-500">
                    在开发者面板中，进入 Projects & Apps 页面。
                  </span>
                </li>
                <li>
                  Click <strong>+ Create Project</strong>. Give it a name (e.g.,
                  &ldquo;Post Scheduler&rdquo;).
                  <br />
                  <span className="text-gray-500 dark:text-gray-500">
                    点击 + Create Project，取个名字（如"Post Scheduler"）。
                  </span>
                </li>
                <li>
                  Under the project, create an <strong>App</strong>. Name it
                  anything you like.
                  <br />
                  <span className="text-gray-500 dark:text-gray-500">
                    在项目下创建一个 App，名称随意。
                  </span>
                </li>
              </ol>
            </div>
          </div>
        </div>

        {/* Step 3 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-start gap-4">
            <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-blue-600 text-white font-bold text-sm">
              3
            </span>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Set App Permissions
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                设置应用权限
              </p>
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-3 text-sm text-amber-800 dark:text-amber-200">
                Important: You must set permissions <strong>before</strong>{" "}
                generating tokens. If you change permissions later, you need to
                regenerate all tokens.
                <br />
                重要：必须在生成 Token 之前设置权限。如果之后更改权限，需要重新生成所有 Token。
              </div>
              <ol className="list-decimal list-inside space-y-2 text-gray-600 dark:text-gray-400 text-sm">
                <li>
                  Go to your App&apos;s <strong>Settings</strong> tab.
                  <br />
                  <span className="text-gray-500 dark:text-gray-500">
                    进入 App 的 Settings 选项卡。
                  </span>
                </li>
                <li>
                  Under <strong>User authentication settings</strong>, click{" "}
                  <strong>Set up</strong>.
                  <br />
                  <span className="text-gray-500 dark:text-gray-500">
                    在 User authentication settings 下点击 Set up。
                  </span>
                </li>
                <li>
                  Set <strong>App permissions</strong> to{" "}
                  <strong>Read and Write</strong>.
                  <br />
                  <span className="text-gray-500 dark:text-gray-500">
                    将 App permissions 设为 Read and Write。
                  </span>
                </li>
                <li>
                  Set type to <strong>Web App</strong>, fill in a callback URL
                  (any valid URL is fine, e.g., your app URL).
                  <br />
                  <span className="text-gray-500 dark:text-gray-500">
                    类型选 Web App，回调 URL 填任意有效 URL（如你的应用地址）。
                  </span>
                </li>
                <li>
                  Save the settings.
                  <br />
                  <span className="text-gray-500 dark:text-gray-500">
                    保存设置。
                  </span>
                </li>
              </ol>
            </div>
          </div>
        </div>

        {/* Step 4 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-start gap-4">
            <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-blue-600 text-white font-bold text-sm">
              4
            </span>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Generate API Key & Secret
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                生成 API Key 和 Secret
              </p>
              <ol className="list-decimal list-inside space-y-2 text-gray-600 dark:text-gray-400 text-sm">
                <li>
                  Go to your App&apos;s <strong>Keys and tokens</strong> tab.
                  <br />
                  <span className="text-gray-500 dark:text-gray-500">
                    进入 App 的 Keys and tokens 选项卡。
                  </span>
                </li>
                <li>
                  Under <strong>Consumer Keys</strong>, click{" "}
                  <strong>Regenerate</strong> (or view if already generated).
                  <br />
                  <span className="text-gray-500 dark:text-gray-500">
                    在 Consumer Keys 下点击 Regenerate（或 View）。
                  </span>
                </li>
                <li>
                  Copy the <strong>API Key</strong> and{" "}
                  <strong>API Key Secret</strong>. Save them securely.
                  <br />
                  <span className="text-gray-500 dark:text-gray-500">
                    复制 API Key 和 API Key Secret，妥善保存。
                  </span>
                </li>
              </ol>
              <div className="mt-3 bg-gray-50 dark:bg-gray-900 rounded-lg p-3 text-sm font-mono">
                <p className="text-gray-500 dark:text-gray-500 mb-1">
                  Example format:
                </p>
                <p className="text-gray-700 dark:text-gray-300">
                  API Key: <code>aB1cD2eF3gH4iJ5kL6</code>
                </p>
                <p className="text-gray-700 dark:text-gray-300">
                  API Secret: <code>mN7oP8qR9sT0uV1wX2yZ3...</code>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Step 5 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-start gap-4">
            <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-blue-600 text-white font-bold text-sm">
              5
            </span>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Generate Access Token & Secret
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                生成 Access Token 和 Secret
              </p>
              <ol className="list-decimal list-inside space-y-2 text-gray-600 dark:text-gray-400 text-sm">
                <li>
                  On the same <strong>Keys and tokens</strong> page, scroll to{" "}
                  <strong>Authentication Tokens</strong>.
                  <br />
                  <span className="text-gray-500 dark:text-gray-500">
                    在同一个 Keys and tokens 页面，向下滚动到 Authentication
                    Tokens 部分。
                  </span>
                </li>
                <li>
                  Click <strong>Generate</strong> under Access Token and Secret.
                  <br />
                  <span className="text-gray-500 dark:text-gray-500">
                    点击 Access Token and Secret 下的 Generate。
                  </span>
                </li>
                <li>
                  Make sure it says{" "}
                  <strong>&ldquo;Created with Read and Write permissions&rdquo;</strong>.
                  <br />
                  <span className="text-gray-500 dark:text-gray-500">
                    确认显示"Created with Read and Write permissions"。
                  </span>
                </li>
                <li>
                  Copy the <strong>Access Token</strong> and{" "}
                  <strong>Access Token Secret</strong>. Save them securely.
                  <br />
                  <span className="text-gray-500 dark:text-gray-500">
                    复制 Access Token 和 Access Token Secret，妥善保存。
                  </span>
                </li>
              </ol>
            </div>
          </div>
        </div>

        {/* Step 6 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-start gap-4">
            <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-green-600 text-white font-bold text-sm">
              6
            </span>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Add Credentials to X Post Scheduler
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                将密钥添加到 X Post Scheduler
              </p>
              <ol className="list-decimal list-inside space-y-2 text-gray-600 dark:text-gray-400 text-sm">
                <li>
                  Sign in to X Post Scheduler and go to the{" "}
                  <Link
                    href="/settings"
                    className="text-blue-600 dark:text-blue-400 underline"
                  >
                    Settings
                  </Link>{" "}
                  page.
                  <br />
                  <span className="text-gray-500 dark:text-gray-500">
                    登录 X Post Scheduler 并进入设置页面。
                  </span>
                </li>
                <li>
                  In the <strong>Add X Account</strong> section, fill in:
                  <br />
                  <span className="text-gray-500 dark:text-gray-500">
                    在"Add X Account"部分填写：
                  </span>
                  <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                    <li>
                      <strong>API Key</strong> → Consumer API Key
                    </li>
                    <li>
                      <strong>API Secret</strong> → Consumer API Key Secret
                    </li>
                    <li>
                      <strong>Access Token</strong> → Access Token
                    </li>
                    <li>
                      <strong>Access Token Secret</strong> → Access Token Secret
                    </li>
                  </ul>
                </li>
                <li>
                  Click <strong>Add Account</strong>. The app will verify your
                  credentials and show your X username.
                  <br />
                  <span className="text-gray-500 dark:text-gray-500">
                    点击 Add Account。应用会验证凭证并显示你的 X 用户名。
                  </span>
                </li>
              </ol>
            </div>
          </div>
        </div>

        {/* Troubleshooting */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Troubleshooting / 常见问题
          </h2>
          <div className="space-y-4 text-sm text-gray-600 dark:text-gray-400">
            <div>
              <p className="font-medium text-gray-900 dark:text-white">
                &ldquo;403 Forbidden&rdquo; when posting
              </p>
              <p>
                Your app permissions are likely set to &ldquo;Read only&rdquo;.
                Change to <strong>Read and Write</strong> in app settings, then{" "}
                <strong>regenerate</strong> both your Access Token and Secret.
              </p>
              <p className="text-gray-500 dark:text-gray-500">
                你的应用权限可能是"只读"。请改为"读写"，然后重新生成 Access Token 和
                Secret。
              </p>
            </div>
            <div>
              <p className="font-medium text-gray-900 dark:text-white">
                &ldquo;401 Unauthorized&rdquo;
              </p>
              <p>
                Double-check that all 4 keys are correct and haven&apos;t been
                regenerated since you copied them.
              </p>
              <p className="text-gray-500 dark:text-gray-500">
                请确认 4 个密钥都正确，且复制后没有被重新生成过。
              </p>
            </div>
            <div>
              <p className="font-medium text-gray-900 dark:text-white">
                &ldquo;429 Too Many Requests&rdquo;
              </p>
              <p>
                You&apos;ve hit the X API rate limit. The free tier allows ~17
                tweets per 24 hours. Wait and try again later.
              </p>
              <p className="text-gray-500 dark:text-gray-500">
                触发了 X API 速率限制。免费套餐每 24 小时约可发 17 条推文，稍后再试。
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
