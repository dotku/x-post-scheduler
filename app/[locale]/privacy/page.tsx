import type { Metadata } from "next";
import Link from "next/link";
import { use } from "react";

export const metadata: Metadata = {
  title: "Privacy Policy | xPilot",
  description: "Privacy policy for xPilot",
};

export function generateStaticParams() {
  return [{ locale: "en" }, { locale: "zh" }];
}

export default function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = use(params);
  const isZh = locale === "zh";

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        {/* Header */}
        <Link
          href={isZh ? "/zh" : "/"}
          className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 mb-8 inline-block text-sm font-medium transition"
        >
          ← {isZh ? "返回首页" : "Back to Home"}
        </Link>

        <div className="mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-2">
            {isZh ? "隐私政策" : "Privacy Policy"}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            {isZh
              ? "最后更新：February 24, 2026"
              : "Last updated: February 24, 2026"}
          </p>
        </div>

        {/* Content */}
        <div
          className={`space-y-8 ${isZh ? "text-base leading-relaxed" : "space-y-8"}`}
        >
          {isZh ? (
            <>
              {/* 1. 信息收集 */}
              <section className="border-l-4 border-blue-500 pl-6 py-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  1. 信息收集和处理依据
                </h2>
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  符合《中华人民共和国个人信息保护法》，xPilot
                  收集和处理以下个人信息：
                </p>
                <ul className="space-y-3 text-gray-700 dark:text-gray-300">
                  <li className="flex gap-3">
                    <span className="text-blue-500 font-bold">•</span>
                    <div>
                      <strong>账户信息：</strong>{" "}
                      注册时提供的名称、邮箱、电话等，用于账户验证和服务提供
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-blue-500 font-bold">•</span>
                    <div>
                      <strong>社交媒体凭证：</strong>{" "}
                      与X、抖音、微博等平台的API令牌，仅用于按您指示发布内容
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-blue-500 font-bold">•</span>
                    <div>
                      <strong>付款信息：</strong>{" "}
                      交易记录和订阅状态，由支付服务商安全处理
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-blue-500 font-bold">•</span>
                    <div>
                      <strong>使用数据：</strong>{" "}
                      IP地址、设备信息、访问日志，用于服务优化和安全防护
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-blue-500 font-bold">•</span>
                    <div>
                      <strong>API调用记录：</strong>{" "}
                      AI功能使用记录，用于计费和服务改进，敏感内容不被存储
                    </div>
                  </li>
                </ul>
              </section>

              {/* 2. 法律依据 */}
              <section className="border-l-4 border-blue-500 pl-6 py-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  2. 法律依据
                </h2>
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  我们基于以下法律依据进行信息处理：
                </p>
                <ul className="space-y-2 text-gray-700 dark:text-gray-300 ml-4">
                  <li>
                    • <strong>合同必需性：</strong> 为履行与您的服务合同
                  </li>
                  <li>
                    • <strong>法律义务：</strong>{" "}
                    为履行税务、会计、反洗钱等法律义务
                  </li>
                  <li>
                    • <strong>明确同意：</strong> 基于您的明确授权同意
                  </li>
                  <li>
                    • <strong>合法利益：</strong> 平台安全、欺诈防范、服务优化
                  </li>
                </ul>
              </section>

              {/* 3. 信息使用 */}
              <section className="border-l-4 border-blue-500 pl-6 py-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  3. 信息使用和跨境转移
                </h2>
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  我们使用信息以提供、维护和改进服务：
                </p>
                <ul className="space-y-2 text-gray-700 dark:text-gray-300 ml-4">
                  <li>• 提供核心服务功能</li>
                  <li>• 处理付款和订阅管理</li>
                  <li>• 发送安全通知和更新</li>
                  <li>• 数据分析和用户体验优化</li>
                  <li>• 欺诈防范和平台安全维护</li>
                </ul>
                <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    <strong>⚠️ 重要说明：</strong>{" "}
                    部分信息处理涉及海外服务商（OpenAI、AWS等）。我们仅转移必要信息，并确保服务商提供充分的数据保护承诺。
                  </p>
                </div>
              </section>

              {/* 4. 数据安全 */}
              <section className="border-l-4 border-blue-500 pl-6 py-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  4. 数据安全措施
                </h2>
                <p className="text-gray-700 dark:text-gray-300 mb-3">
                  数据存储在Vercel和Neon运营的美国云服务器上。我们采用：
                </p>
                <ul className="space-y-2 text-gray-700 dark:text-gray-300 ml-4">
                  <li>✓ 数据库加密（AES-256标准）</li>
                  <li>✓ 传输加密（TLS 1.2及更高版本）</li>
                  <li>✓ 访问控制和多因素认证</li>
                  <li>✓ 定期安全审计和渗透测试</li>
                  <li>✓ 数据备份和灾难恢复机制</li>
                </ul>
              </section>

              {/* 5. 第三方共享 */}
              <section className="border-l-4 border-blue-500 pl-6 py-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  5. 第三方和数据共享
                </h2>
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  我们仅在必要范围内与以下第三方共享信息：
                </p>
                <div className="space-y-3 text-gray-700 dark:text-gray-300">
                  <div>
                    <strong className="text-blue-600 dark:text-blue-400">
                      支付处理商
                    </strong>
                    <p className="ml-4 mt-1">
                      Stripe（美国）和微信支付（中国），用于处理购买
                    </p>
                  </div>
                  <div>
                    <strong className="text-blue-600 dark:text-blue-400">
                      云服务商
                    </strong>
                    <p className="ml-4 mt-1">
                      Vercel、Neon、AWS用于托管和基础设施
                    </p>
                  </div>
                  <div>
                    <strong className="text-blue-600 dark:text-blue-400">
                      AI模型提供商
                    </strong>
                    <p className="ml-4 mt-1">
                      OpenAI（美国），仅传输用户文本和指令
                    </p>
                  </div>
                  <div>
                    <strong className="text-blue-600 dark:text-blue-400">
                      分析服务
                    </strong>
                    <p className="ml-4 mt-1">Vercel Analytics，匿名使用统计</p>
                  </div>
                </div>
                <p className="mt-4 text-gray-700 dark:text-gray-300">
                  <strong>声明：</strong>{" "}
                  我们不向任何第三方出售个人信息。所有合作均受严格的数据处理协议约束。
                </p>
              </section>

              {/* 6. 数据保留 */}
              <section className="border-l-4 border-blue-500 pl-6 py-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  6. 数据保留和删除权
                </h2>
                <p className="text-gray-700 dark:text-gray-300">
                  除法律要求外，我们在您停止使用服务后90天内删除大部分数据。交易记录因税务需要保留5-7年。您可随时请求删除账户及所有数据。
                </p>
              </section>

              {/* 7. 用户权利 */}
              <section className="border-l-4 border-green-500 pl-6 py-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  7. 您的权利（符合PIPL标准）
                </h2>
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  根据法律，您拥有以下权利：
                </p>
                <ul className="space-y-2 text-gray-700 dark:text-gray-300 ml-4">
                  <li>
                    <strong>知情权：</strong> 了解我们收集和处理的信息及其用途
                  </li>
                  <li>
                    <strong>访问权：</strong> 获取您的个人数据副本
                  </li>
                  <li>
                    <strong>更正权：</strong> 更正不准确或不完整的数据
                  </li>
                  <li>
                    <strong>删除权：</strong> 在满足条件的情况下请求删除数据
                  </li>
                  <li>
                    <strong>撤回同意权：</strong> 撤回基于同意的数据处理
                  </li>
                  <li>
                    <strong>异议权：</strong> 对特定处理方式提出异议
                  </li>
                </ul>
              </section>

              {/* 8. 联系 */}
              <section className="border-l-4 border-orange-500 pl-6 py-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  8. 联系我们
                </h2>
                <div className="bg-orange-50 dark:bg-orange-900/30 rounded-lg border border-orange-200 dark:border-orange-800 p-4 text-gray-700 dark:text-gray-300">
                  <p className="mb-3">
                    如对隐私政策有疑问或想行使上述权利，请通过以下方式联系：
                  </p>
                  <ul className="space-y-2 ml-4">
                    <li>
                      <strong>微信客服：</strong> techfront-robot 或
                      xinmai002leo
                    </li>
                    <li>
                      <strong>电子邮件：</strong> support@xpilot.app
                    </li>
                  </ul>
                  <p className="mt-3 text-sm">
                    如对我们的处理不满意，您可向有关数据保护部门投诉。
                  </p>
                </div>
              </section>
            </>
          ) : (
            <>
              <section className="border-l-4 border-blue-500 pl-6 py-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  1. Information Collection (GDPR/CCPA Compliant)
                </h2>
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  xPilot collects the following personal information to provide
                  and improve our services:
                </p>
                <ul className="space-y-3 text-gray-700 dark:text-gray-300">
                  <li className="flex gap-3">
                    <span className="text-blue-500 font-bold">•</span>
                    <div>
                      <strong>Account Information:</strong> Name, email, phone
                      provided during registration
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-blue-500 font-bold">•</span>
                    <div>
                      <strong>Social Media Credentials:</strong> API tokens for
                      X, TikTok, Instagram, and other platforms
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-blue-500 font-bold">•</span>
                    <div>
                      <strong>Payment Information:</strong> Transaction records
                      and subscription status
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-blue-500 font-bold">•</span>
                    <div>
                      <strong>Usage Data:</strong> IP address, device
                      information, and access logs
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-blue-500 font-bold">•</span>
                    <div>
                      <strong>API Usage Records:</strong> Logs of AI generation
                      and platform usage for billing and improvement
                    </div>
                  </li>
                </ul>
              </section>

              <section className="border-l-4 border-blue-500 pl-6 py-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  2. Legal Basis for Processing
                </h2>
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  We process your data based on:
                </p>
                <ul className="space-y-2 text-gray-700 dark:text-gray-300 ml-4">
                  <li>
                    • <strong>Contract Necessity:</strong> To deliver our
                    services
                  </li>
                  <li>
                    • <strong>Legal Compliance:</strong> Tax, regulatory, and
                    anti-fraud obligations
                  </li>
                  <li>
                    • <strong>Your Consent:</strong> Where you have explicitly
                    opted in
                  </li>
                  <li>
                    • <strong>Legitimate Interests:</strong> Security, fraud
                    prevention, service optimization
                  </li>
                </ul>
              </section>

              <section className="border-l-4 border-blue-500 pl-6 py-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  3. How We Use Your Data
                </h2>
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  We use collected information to:
                </p>
                <ul className="space-y-2 text-gray-700 dark:text-gray-300 ml-4">
                  <li>• Provide, maintain, and improve service features</li>
                  <li>• Process payments and manage subscriptions</li>
                  <li>• Send service updates and security notifications</li>
                  <li>• Analyze usage patterns and optimize user experience</li>
                  <li>• Prevent fraud and maintain platform security</li>
                </ul>
                <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    <strong>⚠️ International Transfers:</strong> Some processing
                    involves US-based service providers. We ensure adequate
                    safeguards via Data Processing Agreements.
                  </p>
                </div>
              </section>

              <section className="border-l-4 border-blue-500 pl-6 py-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  4. Data Security
                </h2>
                <p className="text-gray-700 dark:text-gray-300 mb-3">
                  Your data is stored on US-based Vercel and Neon servers. We
                  implement:
                </p>
                <ul className="space-y-2 text-gray-700 dark:text-gray-300 ml-4">
                  <li>✓ AES-256 database encryption</li>
                  <li>✓ TLS 1.2+ transport security</li>
                  <li>✓ Multi-factor authentication</li>
                  <li>✓ Regular security audits and penetration testing</li>
                  <li>✓ Automated backups and disaster recovery</li>
                </ul>
              </section>

              <section className="border-l-4 border-blue-500 pl-6 py-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  5. Third-Party Data Sharing
                </h2>
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  We share information only with:
                </p>
                <div className="space-y-3 text-gray-700 dark:text-gray-300">
                  <div>
                    <strong className="text-blue-600 dark:text-blue-400">
                      Payment Processors
                    </strong>
                    <p className="ml-4 mt-1">
                      Stripe (US) and WeChat Pay (China)
                    </p>
                  </div>
                  <div>
                    <strong className="text-blue-600 dark:text-blue-400">
                      Cloud Providers
                    </strong>
                    <p className="ml-4 mt-1">
                      Vercel, Neon, AWS for hosting and infrastructure
                    </p>
                  </div>
                  <div>
                    <strong className="text-blue-600 dark:text-blue-400">
                      AI Providers
                    </strong>
                    <p className="ml-4 mt-1">
                      OpenAI (US) — only user-provided text and instructions
                    </p>
                  </div>
                  <div>
                    <strong className="text-blue-600 dark:text-blue-400">
                      Analytics
                    </strong>
                    <p className="ml-4 mt-1">
                      Vercel Analytics for anonymized usage
                    </p>
                  </div>
                </div>
                <p className="mt-4 text-gray-700 dark:text-gray-300">
                  <strong>Statement:</strong> We never sell your data. All
                  partnerships are governed by strict Data Processing
                  Agreements.
                </p>
              </section>

              <section className="border-l-4 border-blue-500 pl-6 py-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  6. Data Retention
                </h2>
                <p className="text-gray-700 dark:text-gray-300">
                  Except where required by law, we delete most personal data
                  within 90 days of service termination. Tax and legal records
                  are retained 5-7 years per regulatory requirements. You can
                  request deletion anytime.
                </p>
              </section>

              <section className="border-l-4 border-green-500 pl-6 py-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  7. Your Data Rights (GDPR/CCPA)
                </h2>
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  You have the right to:
                </p>
                <ul className="space-y-2 text-gray-700 dark:text-gray-300 ml-4">
                  <li>
                    <strong>Access:</strong> Request a copy of your personal
                    data
                  </li>
                  <li>
                    <strong>Rectification:</strong> Correct inaccurate
                    information
                  </li>
                  <li>
                    <strong>Erasure:</strong> Request deletion under applicable
                    conditions
                  </li>
                  <li>
                    <strong>Restrict Processing:</strong> Limit how we process
                    your data
                  </li>
                  <li>
                    <strong>Data Portability:</strong> Export your data in
                    standard format
                  </li>
                  <li>
                    <strong>Withdraw Consent:</strong> Revoke consent-based
                    processing
                  </li>
                  <li>
                    <strong>Opt-Out (CCPA):</strong> We do not sell your
                    information
                  </li>
                  <li>
                    <strong>Lodge Complaints:</strong> Contact your local data
                    protection authority
                  </li>
                </ul>
              </section>

              <section className="border-l-4 border-orange-500 pl-6 py-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  8. Contact Us
                </h2>
                <div className="bg-orange-50 dark:bg-orange-900/30 rounded-lg border border-orange-200 dark:border-orange-800 p-4 text-gray-700 dark:text-gray-300">
                  <p className="mb-3">
                    To exercise your rights or for privacy inquiries:
                  </p>
                  <ul className="space-y-2 ml-4">
                    <li>
                      <strong>WeChat:</strong> techfront-robot or xinmai002leo
                    </li>
                    <li>
                      <strong>Email:</strong>support@xpilot.app
                    </li>
                  </ul>
                  <p className="mt-3 text-sm">
                    You can also lodge formal complaints with your local data
                    protection authority.
                  </p>
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
