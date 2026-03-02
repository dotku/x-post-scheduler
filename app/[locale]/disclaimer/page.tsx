import type { Metadata } from "next";
import Link from "next/link";
import { use } from "react";

export const metadata: Metadata = {
  title: "Disclaimer | xPilot",
  description: "Disclaimer for xPilot",
};

export function generateStaticParams() {
  return [{ locale: "en" }, { locale: "zh" }];
}

export default function DisclaimerPage({
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
            {isZh ? "免责声明" : "Disclaimer"}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            {isZh
              ? "最后更新：March 2, 2026"
              : "Last updated: March 2, 2026"}
          </p>
        </div>

        <div className="space-y-8">
          {isZh ? (
            <>
              {/* 中文版本 */}
              <section className="border-l-4 border-red-500 pl-6 py-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  1. AI生成内容准确性免责
                </h2>
                <div className="bg-red-50 dark:bg-red-900/30 rounded-lg border border-red-200 dark:border-red-800 p-4 mb-4 text-gray-700 dark:text-gray-300">
                  <p className="font-bold mb-2">⚠️ 重要警告：</p>
                  <p className="text-sm">
                    xPilot使用AI模型（OpenAI等）生成内容。AI生成的内容可能包含事实错误、过时信息、不准确的数据或不当建议。用户对所有AI生成内容的准确性和适用性全权负责。
                  </p>
                </div>
                <p className="text-gray-700 dark:text-gray-300">
                  xPilot不保证AI生成内容的准确性、完整性、适时性或特定用途的适用性。用户必须在发布前自行审查、验证和编辑所有内容。xPilot对AI生成内容引起的任何错误、遗漏或误导信息不承担法律责任。
                </p>
              </section>

              <section className="border-l-4 border-red-500 pl-6 py-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  2. 社交媒体平台责任免责
                </h2>
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  xPilot与X、抖音、微博等社交平台集成，但用户对所有发布到这些平台的内容负全部责任。具体包括：
                </p>
                <ul className="space-y-2 text-gray-700 dark:text-gray-300 ml-4">
                  <li>• xPilot不对第三方平台的内容审核、算法推荐或去除负责</li>
                  <li>
                    • xPilot不对社交平台的服务中断、功能变更或账户被禁言负责
                  </li>
                  <li>
                    • xPilot不对用户在社交平台上的粉丝互动、评论或投诉负责
                  </li>
                  <li>
                    •
                    用户对违反各社交平台规则的内容全权负责，包括被平台删除或账户被封禁
                  </li>
                  <li>
                    •
                    各平台判定内容违规的标准各不相同，xPilot不能保证内容在所有平台都合规
                  </li>
                </ul>
              </section>

              <section className="border-l-4 border-red-500 pl-6 py-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  3. 知识产权和侵权免责
                </h2>
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  xPilot对用户生成或发布的内容侵犯他人知识产权不承担责任：
                </p>
                <ul className="space-y-2 text-gray-700 dark:text-gray-300 ml-4">
                  <li>
                    •
                    用户完全负责确保自己创建的内容不侵犯他人著作权、商标权、专利权或其他权利
                  </li>
                  <li>• xPilot不审查或验证用户内容的知识产权合法性</li>
                  <li>
                    • 第三方投诉侵权时，xPilot有权删除内容、暂停账户或终止服务
                  </li>
                  <li>
                    • 用户因侵权投诉引致的法律诉讼、罚款或赔偿由用户独自承担
                  </li>
                  <li>
                    • AI生成内容可能与现有作品相似，用户应在发布前确认不存在侵权
                  </li>
                </ul>
              </section>

              <section className="border-l-4 border-red-500 pl-6 py-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  4. 商业和法律合规免责
                </h2>
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  xPilot不对用户内容的商业合规性负责：
                </p>
                <ul className="space-y-2 text-gray-700 dark:text-gray-300 ml-4">
                  <li>
                    • <strong>广告法合规：</strong>{" "}
                    xPilot不保证生成内容符合《广告法》《网络广告监管规定》等法规。用户发布广告内容前需自行确认合规性
                  </li>
                  <li>
                    • <strong>商业宣传：</strong>{" "}
                    任何商业宣传、产品推荐或营销信息需符合相关法律，xPilot不审查商业合规性
                  </li>
                  <li>
                    • <strong>财务建议：</strong>{" "}
                    AI生成的任何财务、投资或商业建议仅供参考，不构成专业意见，用户自行承担风险
                  </li>
                  <li>
                    • <strong>医疗/科学声明：</strong>{" "}
                    任何医疗、健康或科学相关内容需用户自行验证，xPilot不保证其医学准确性
                  </li>
                  <li>
                    • <strong>税务/法律建议：</strong>{" "}
                    xPilot生成的内容不构成税务或法律建议，用户应咨询专业人士
                  </li>
                </ul>
              </section>

              <section className="border-l-4 border-red-500 pl-6 py-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  5. 隐私和数据安全免责
                </h2>
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  关于数据处理和隐私保护，xPilot明确声明：
                </p>
                <ul className="space-y-2 text-gray-700 dark:text-gray-300 ml-4">
                  <li>
                    •
                    用户输入的任何个人信息、敏感数据或隐私信息将被发送至OpenAI（美国服务器）进行处理
                  </li>
                  <li>• xPilot不对用户在生成内容时泄露的个人信息承担责任</li>
                  <li>
                    •
                    用户不应将身份证号、银行卡信息、密码等敏感信息输入到AI生成工具中
                  </li>
                  <li>
                    • xPilot对第三方（包括OpenAI）对用户数据的处理政策不承担责任
                  </li>
                  <li>
                    •
                    数据泄露、黑客攻击或未授权访问虽然xPilot会尽力防止，但xPilot不保证绝对安全
                  </li>
                </ul>
              </section>

              <section className="border-l-4 border-red-500 pl-6 py-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  6. 平台可用性和服务中断免责
                </h2>
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  xPilot对服务中断、延迟或不可用不承担责任：
                </p>
                <ul className="space-y-2 text-gray-700 dark:text-gray-300 ml-4">
                  <li>• 系统维护、升级、漏洞修复可能导致服务中断</li>
                  <li>
                    •
                    网络故障、互联网中断、电力问题等基础设施问题超出xPilot控制范围
                  </li>
                  <li>
                    •
                    第三方API（OpenAI、社交平台等）故障或服务中止不由xPilot负责
                  </li>
                  <li>
                    • 网络攻击、黑客入侵或DDoS攻击引致的服务中断xPilot不承担责任
                  </li>
                  <li>• xPilot保留在任何情况下中止或修改服务的权利</li>
                </ul>
              </section>

              <section className="border-l-4 border-red-500 pl-6 py-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  7. 用户行为和违法内容免责
                </h2>
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  xPilot对用户发布的违法或有害内容不承担责任：
                </p>
                <ul className="space-y-2 text-gray-700 dark:text-gray-300 ml-4">
                  <li>
                    • 用户对发布的所有内容的合法性、真实性、不违法性负全部责任
                  </li>
                  <li>
                    •
                    xPilot不预审内容，不对发布的违法信息、仇恨言论、诽谤、骚扰等负责
                  </li>
                  <li>
                    •
                    用户因发布违法内容而引致的所有法律后果（逮捕、起诉、罚款等）由用户独自承担
                  </li>
                  <li>• xPilot有权在收到通知后立即删除违法内容并账户禁用</li>
                  <li>
                    •
                    xPilot配合执法部门调查时，用户同意将其信息和行为记录提交给执法部门
                  </li>
                </ul>
              </section>

              <section className="border-l-4 border-red-500 pl-6 py-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  8. 第三方服务和链接免责
                </h2>
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  xPilot与第三方的集成和服务：
                </p>
                <ul className="space-y-2 text-gray-700 dark:text-gray-300 ml-4">
                  <li>
                    •
                    xPilot可能包含指向第三方网站的链接，xPilot不对这些网站的内容、准确性或安全性负责
                  </li>
                  <li>
                    • 用户通过xPilot访问第三方服务时，应阅读其隐私政策和服务条款
                  </li>
                  <li>
                    •
                    xPilot与OpenAI、Stripe、社交平台等的合作不构成对其服务的担保
                  </li>
                  <li>• 这些第三方对其服务的中断或问题不由xPilot负责</li>
                </ul>
              </section>

              <section className="border-l-4 border-red-500 pl-6 py-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  9. 财务损失、支付和提现免责
                </h2>
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  xPilot对因使用本平台而导致的财务或其他损失不承担责任：
                </p>
                <ul className="space-y-2 text-gray-700 dark:text-gray-300 ml-4">
                  <li>
                    •
                    任何因AI内容错误、平台故障、安全问题或其他原因导致的经济损失由用户自行承担
                  </li>
                  <li>
                    •
                    xPilot不赔偿因以下原因导致的任何损失：购粉失败、销售下滑、粉丝掉粉、账户被封禁等
                  </li>
                  <li>
                    •
                    用户对使用AI生成内容的所有后果（包括销售不利、曝光率下降等）自己负责
                  </li>
                  <li>
                    • <strong>支付处理：</strong>{" "}
                    所有支付由第三方支付处理商（Stripe, Inc.）处理。xPilot不直接持有用户资金。因Stripe服务中断、政策变更或技术故障导致的支付延迟或失败，xPilot不承担责任
                  </li>
                  <li>
                    • <strong>提现延迟：</strong>{" "}
                    提现到银行账户的处理时间取决于Stripe和收款银行。标准提现通常需要2-3个工作日，但可能因银行处理时间、节假日或其他因素而延迟。xPilot不对提现延迟承担责任
                  </li>
                  <li>
                    • <strong>银行信息错误：</strong>{" "}
                    因用户提供的银行账户信息（路由号码、账户号码）错误导致的转账失败或资金丢失，由用户自行承担。xPilot不负责找回因错误银行信息导致的资金损失
                  </li>
                  <li>
                    • <strong>活动收入纠纷：</strong>{" "}
                    活动创建者与其客户之间的付款纠纷由双方自行解决。xPilot作为技术平台提供方，不充当仲裁者或担保人
                  </li>
                  <li>
                    • <strong>平台服务费：</strong>{" "}
                    xPilot收取的5%平台服务费为不可退还的服务费用，一经扣除不予返还
                  </li>
                  <li>
                    • <strong>API积分：</strong>{" "}
                    API积分为预付费虚拟额度，仅用于平台AI功能消耗。积分不可转让、不可兑换现金、不可提现。用户账户中未使用的积分不产生利息
                  </li>
                  <li>
                    • <strong>责任上限：</strong>{" "}
                    即使xPilot应承担责任，最多赔偿用户过去12个月支付的全部费用，不包含任何间接或附带损害
                  </li>
                </ul>
              </section>

              <section className="border-l-4 border-red-500 pl-6 py-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  10. 使用平台的风险
                </h2>
                <div className="bg-red-50 dark:bg-red-900/30 rounded-lg border border-red-200 dark:border-red-800 p-4 text-gray-700 dark:text-gray-300">
                  <p className="font-bold mb-3">用户明确理解并同意：</p>
                  <ul className="space-y-2 text-sm ml-4">
                    <li>
                      • 使用AI生成的内容存在内容不准确、过时、不当或有害的风险
                    </li>
                    <li>
                      • 发布AI生成内容可能违反社交平台规则，导致账户被删除或禁言
                    </li>
                    <li>• AI生成内容可能与现有作品相似，引致知识产权纠纷</li>
                    <li>• 平台可能随时停止服务或改变功能</li>
                    <li>• 用户数据可能被发送至国外服务器，存在跨境数据风险</li>
                    <li>• 使用本平台的所有风险由用户自行承担</li>
                  </ul>
                </div>
              </section>

              <section className="border-l-4 border-red-500 pl-6 py-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  11. 条款修改和更新
                </h2>
                <p className="text-gray-700 dark:text-gray-300">
                  xPilot可随时修改本免责声明，无需通知。继续使用平台即表示接受修改后的条款。用户应定期查看本页面以了解最新的免责声明。重要变更时xPilot会通过邮件通知，但不能保证所有用户都会收到。
                </p>
              </section>

              <section className="border-l-4 border-orange-500 pl-6 py-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  12. 联系和反馈
                </h2>
                <div className="bg-orange-50 dark:bg-orange-900/30 rounded-lg border border-orange-200 dark:border-orange-800 p-4 text-gray-700 dark:text-gray-300">
                  <p className="mb-3">
                    如对本免责声明有任何疑问或需要报告安全问题：
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
                    对于侵权投诉或法律事宜，请按《隐私政策》中的联系方式处理。
                  </p>
                </div>
              </section>
            </>
          ) : (
            <>
              {/* English Version */}
              <section className="border-l-4 border-red-500 pl-6 py-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  1. AI Content Accuracy Disclaimer
                </h2>
                <div className="bg-red-50 dark:bg-red-900/30 rounded-lg border border-red-200 dark:border-red-800 p-4 mb-4 text-gray-700 dark:text-gray-300">
                  <p className="font-bold mb-2">⚠️ Important Warning:</p>
                  <p className="text-sm">
                    xPilot uses AI models (OpenAI, etc.) to generate content.
                    AI-generated content may contain factual errors, outdated
                    information, inaccurate data, or inappropriate suggestions.
                    Users bear sole responsibility for the accuracy and
                    applicability of all AI-generated content.
                  </p>
                </div>
                <p className="text-gray-700 dark:text-gray-300">
                  xPilot does not warrant the accuracy, completeness,
                  timeliness, or suitability of AI-generated content for any
                  purpose. Users must review, verify, and edit all content
                  before publication. xPilot assumes no liability for errors,
                  omissions, or misleading information in AI-generated content.
                </p>
              </section>

              <section className="border-l-4 border-red-500 pl-6 py-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  2. Social Media Platform Disclaimer
                </h2>
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  xPilot integrates with X, TikTok, Weibo, and other platforms,
                  but users bear full responsibility for all published content.
                  Specifically:
                </p>
                <ul className="space-y-2 text-gray-700 dark:text-gray-300 ml-4">
                  <li>
                    • xPilot is not responsible for platform content moderation,
                    algorithmic recommendations, or content removal
                  </li>
                  <li>
                    • xPilot is not responsible for third-party platform
                    outages, feature changes, or account suspensions
                  </li>
                  <li>
                    • xPilot is not responsible for follower interactions,
                    comments, or complaints on social platforms
                  </li>
                  <li>
                    • Users bear full responsibility for content violating
                    platform rules and resulting account actions
                  </li>
                  <li>
                    • Each platform has different content standards; xPilot
                    cannot guarantee compliance across all platforms
                  </li>
                </ul>
              </section>

              <section className="border-l-4 border-red-500 pl-6 py-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  3. Intellectual Property Infringement Disclaimer
                </h2>
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  xPilot assumes no responsibility for intellectual property
                  infringement in user-generated content:
                </p>
                <ul className="space-y-2 text-gray-700 dark:text-gray-300 ml-4">
                  <li>
                    • Users bear sole responsibility for ensuring content does
                    not infringe copyrights, trademarks, patents, or other
                    rights
                  </li>
                  <li>
                    • xPilot does not review or verify IP compliance of user
                    content
                  </li>
                  <li>
                    • xPilot may remove infringing content and suspend accounts
                    upon notice of infringement
                  </li>
                  <li>
                    • Users bear all legal consequences of IP infringement
                    claims, including lawsuits and damages
                  </li>
                  <li>
                    • AI-generated content may inadvertently resemble existing
                    works; users must verify no infringement exists
                  </li>
                </ul>
              </section>

              <section className="border-l-4 border-red-500 pl-6 py-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  4. Commercial and Legal Compliance Disclaimer
                </h2>
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  xPilot assumes no responsibility for commercial compliance of
                  user content:
                </p>
                <ul className="space-y-2 text-gray-700 dark:text-gray-300 ml-4">
                  <li>
                    • <strong>Advertising Compliance:</strong> xPilot does not
                    guarantee AI content complies with advertising laws. Users
                    must verify compliance before promoting products
                  </li>
                  <li>
                    • <strong>Marketing Claims:</strong> Commercial promotions,
                    product recommendations, and marketing messages must comply
                    with applicable laws; xPilot does not review
                  </li>
                  <li>
                    • <strong>Financial Advice:</strong> AI-generated financial,
                    investment, or business suggestions are informational only
                    and not professional advice; users assume all risks
                  </li>
                  <li>
                    • <strong>Medical/Scientific Claims:</strong> Medical,
                    health, or scientific content requires user verification;
                    xPilot does not warrant medical accuracy
                  </li>
                  <li>
                    • <strong>Tax/Legal Advice:</strong> xPilot content is not
                    tax or legal advice; users should consult professionals
                  </li>
                </ul>
              </section>

              <section className="border-l-4 border-red-500 pl-6 py-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  5. Privacy and Data Security Disclaimer
                </h2>
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  Regarding data processing and privacy protection, xPilot
                  explicitly states:
                </p>
                <ul className="space-y-2 text-gray-700 dark:text-gray-300 ml-4">
                  <li>
                    • Any personal information, sensitive data, or private
                    information users input will be sent to OpenAI (US servers)
                    for processing
                  </li>
                  <li>
                    • xPilot is not responsible for personal information
                    disclosed by users during content generation
                  </li>
                  <li>
                    • Users should never input identity numbers, bank details,
                    passwords, or sensitive credentials into AI tools
                  </li>
                  <li>
                    • xPilot is not responsible for third-party (including
                    OpenAI) data handling policies
                  </li>
                  <li>
                    • While xPilot works to prevent data breaches and
                    unauthorized access, xPilot does not guarantee absolute
                    security
                  </li>
                </ul>
              </section>

              <section className="border-l-4 border-red-500 pl-6 py-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  6. Service Availability Disclaimer
                </h2>
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  xPilot assumes no responsibility for service interruptions,
                  delays, or unavailability:
                </p>
                <ul className="space-y-2 text-gray-700 dark:text-gray-300 ml-4">
                  <li>
                    • System maintenance, upgrades, and security updates may
                    cause service interruptions
                  </li>
                  <li>
                    • Network failures, internet outages, and power issues are
                    beyond xPilot's control
                  </li>
                  <li>
                    • Third-party API failures (OpenAI, social platforms) are
                    not xPilot's responsibility
                  </li>
                  <li>
                    • Cyberattacks, hacking, or DDoS attacks causing service
                    disruptions are not xPilot's liability
                  </li>
                  <li>
                    • xPilot reserves the right to discontinue or modify
                    services at any time
                  </li>
                </ul>
              </section>

              <section className="border-l-4 border-red-500 pl-6 py-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  7. User Behavior and Illegal Content Disclaimer
                </h2>
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  xPilot assumes no responsibility for illegal or harmful
                  user-published content:
                </p>
                <ul className="space-y-2 text-gray-700 dark:text-gray-300 ml-4">
                  <li>
                    • Users bear sole responsibility for the lawfulness,
                    truthfulness, and non-infringement of published content
                  </li>
                  <li>
                    • xPilot does not pre-screen content and assumes no
                    liability for illegal information, hate speech, defamation,
                    or harassment
                  </li>
                  <li>
                    • Users bear all legal consequences from publishing illegal
                    content, including prosecution, fines, and damages
                  </li>
                  <li>
                    • xPilot may immediately remove illegal content and suspend
                    accounts upon notice
                  </li>
                  <li>
                    • xPilot cooperates with law enforcement and may disclose
                    user information to authorities
                  </li>
                </ul>
              </section>

              <section className="border-l-4 border-red-500 pl-6 py-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  8. Third-Party Services and Links Disclaimer
                </h2>
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  Regarding xPilot's third-party integrations:
                </p>
                <ul className="space-y-2 text-gray-700 dark:text-gray-300 ml-4">
                  <li>
                    • xPilot may contain links to third-party websites; xPilot
                    assumes no responsibility for their content, accuracy, or
                    security
                  </li>
                  <li>
                    • Users should review third-party privacy policies and terms
                    of service
                  </li>
                  <li>
                    • xPilot's partnerships with OpenAI, Stripe, and social
                    platforms do not constitute warranties
                  </li>
                  <li>
                    • Third-party service disruptions are not xPilot's
                    responsibility
                  </li>
                </ul>
              </section>

              <section className="border-l-4 border-red-500 pl-6 py-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  9. Financial Loss, Payments & Withdrawals Disclaimer
                </h2>
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  xPilot assumes no responsibility for financial or other losses
                  from platform use:
                </p>
                <ul className="space-y-2 text-gray-700 dark:text-gray-300 ml-4">
                  <li>
                    • All economic losses from AI content errors, platform
                    failures, security issues, or other causes are the user's
                    responsibility
                  </li>
                  <li>
                    • xPilot does not indemnify losses from posting failures,
                    sales decline, follower loss, or account suspension
                  </li>
                  <li>
                    • Users assume full consequences of using AI-generated
                    content, including decreased sales or engagement
                  </li>
                  <li>
                    • <strong>Payment Processing:</strong> All payments are
                    processed by Stripe, Inc. xPilot does not directly hold user
                    funds. xPilot is not responsible for payment delays or
                    failures caused by Stripe service interruptions, policy
                    changes, or technical issues
                  </li>
                  <li>
                    • <strong>Withdrawal Delays:</strong> Processing time for
                    withdrawals to bank accounts depends on Stripe and the
                    receiving bank. Standard withdrawals typically take 2-3
                    business days but may be delayed due to bank processing,
                    holidays, or other factors. xPilot is not liable for
                    withdrawal delays
                  </li>
                  <li>
                    • <strong>Incorrect Bank Details:</strong> Transfer failures
                    or fund losses resulting from incorrect bank account
                    information (routing number, account number) provided by the
                    user are the user's sole responsibility. xPilot is not
                    responsible for recovering funds lost due to incorrect bank
                    details
                  </li>
                  <li>
                    • <strong>Campaign Earnings Disputes:</strong> Payment
                    disputes between campaign creators and their clients are
                    resolved between the parties. xPilot, as a technology
                    platform provider, does not act as an arbitrator or
                    guarantor
                  </li>
                  <li>
                    • <strong>Platform Fee:</strong> The 5% platform service fee
                    charged by xPilot is non-refundable once deducted
                  </li>
                  <li>
                    • <strong>API Credits:</strong> API Credits are prepaid
                    virtual credits used exclusively for AI features on the
                    platform. Credits are non-transferable,
                    non-exchangeable for cash, and non-withdrawable. Unused
                    credits in user accounts do not accrue interest
                  </li>
                  <li>
                    • <strong>Liability Cap:</strong> Even if xPilot bears
                    liability, maximum recovery is limited to total fees paid in
                    the past 12 months, excluding indirect or consequential
                    damages
                  </li>
                </ul>
              </section>

              <section className="border-l-4 border-red-500 pl-6 py-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  10. Platform Use Risks
                </h2>
                <div className="bg-red-50 dark:bg-red-900/30 rounded-lg border border-red-200 dark:border-red-800 p-4 text-gray-700 dark:text-gray-300">
                  <p className="font-bold mb-3">
                    Users explicitly acknowledge and accept:
                  </p>
                  <ul className="space-y-2 text-sm ml-4">
                    <li>
                      • Risk of inaccurate, outdated, inappropriate, or harmful
                      AI-generated content
                    </li>
                    <li>
                      • Risk of violating social platform rules, resulting in
                      account deletion or suspension
                    </li>
                    <li>
                      • Risk of IP infringement claims from AI content
                      similarity to existing works
                    </li>
                    <li>
                      • Risk of platform service discontinuation or feature
                      modifications
                    </li>
                    <li>
                      • Risk of data transmission to foreign servers with
                      associated data transfer risks
                    </li>
                    <li>• Users assume all risks of platform use</li>
                  </ul>
                </div>
              </section>

              <section className="border-l-4 border-red-500 pl-6 py-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  11. Term Modifications and Updates
                </h2>
                <p className="text-gray-700 dark:text-gray-300">
                  xPilot may modify this Disclaimer at any time without notice.
                  Continued platform use constitutes acceptance of
                  modifications. Users should review this page regularly for
                  updates. While xPilot notifies users of material changes via
                  email, xPilot cannot guarantee all users receive notice.
                </p>
              </section>

              <section className="border-l-4 border-orange-500 pl-6 py-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  12. Contact and Feedback
                </h2>
                <div className="bg-orange-50 dark:bg-orange-900/30 rounded-lg border border-orange-200 dark:border-orange-800 p-4 text-gray-700 dark:text-gray-300">
                  <p className="mb-3">
                    For questions about this Disclaimer or to report security
                    issues:
                  </p>
                  <ul className="space-y-2 ml-4">
                    <li>
                      <strong>WeChat:</strong> techfront-robot or xinmai002leo
                    </li>
                    <li>
                      <strong>Email:</strong> support@xpilot.app
                    </li>
                  </ul>
                  <p className="mt-3 text-sm">
                    For copyright infringement or legal matters, use the contact
                    methods in the Privacy Policy.
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
