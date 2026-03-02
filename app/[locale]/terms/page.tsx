import type { Metadata } from "next";
import Link from "next/link";
import { use } from "react";

export const metadata: Metadata = {
  title: "Terms of Service | xPilot",
  description: "Terms of service for xPilot",
};

export function generateStaticParams() {
  return [{ locale: "en" }, { locale: "zh" }];
}

export default function TermsPage({
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
            {isZh ? "服务条款" : "Terms of Service"}
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
              {/* 1. 总则和协议生效 */}
              <section className="border-l-4 border-blue-500 pl-6 py-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  1. 总则和协议生效
                </h2>
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  本服务条款（以下简称"本条款"）由xPilot与用户共同协议制定。访问和使用xPilot平台（https://xpilot.app）及其相关服务即表示您接受本条款的所有条件。
                </p>
                <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800 p-4 text-gray-700 dark:text-gray-300 text-sm">
                  <p>
                    <strong>重要声明：</strong>{" "}
                    本条款受中华人民共和国法律管辖，具体适用《消费者权益保护法》、《电子商务法》、《网络安全法》、《个人信息保护法》等相关法律。任何争议由上海市浦东新区人民法院管辖。
                  </p>
                </div>
              </section>

              {/* 2. 账户管理和用户责任 */}
              <section className="border-l-4 border-blue-500 pl-6 py-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  2. 账户管理和用户责任
                </h2>
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  用户对自己的账户安全和活动完全负责。具体要求如下：
                </p>
                <ul className="space-y-2 text-gray-700 dark:text-gray-300 ml-4">
                  <li>
                    •
                    提供真实、准确、合法的注册信息，包括真实身份证明或企业营业执照
                  </li>
                  <li>• 采取合理措施保护账户密码、API密钥等安全凭证</li>
                  <li>• 立即通知xPilot任何未授权使用或安全漏洞</li>
                  <li>• 定期审查账户登录记录和操作日志</li>
                  <li>
                    • 对账户内所有活动（包括第三方授权行为）承担全部法律责任
                  </li>
                  <li>• 不得出租、转让或分享账户，违反视为违约</li>
                </ul>
              </section>

              {/* 3. 禁止性行为和内容规范 */}
              <section className="border-l-4 border-blue-500 pl-6 py-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  3. 禁止性行为和内容规范
                </h2>
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  用户禁止通过xPilot平台进行下列行为：
                </p>
                <ul className="space-y-2 text-gray-700 dark:text-gray-300 ml-4">
                  <li>
                    •
                    发布或传输违反《刑法》《网络安全法》《电信条例》的内容，包括：危害国家安全、颠覆政权、煽动分裂、宗教极端主义等违法内容
                  </li>
                  <li>
                    •
                    发布涉及诈骗、传销、博彩的信息，违反《反洗钱法》《电商法》规定
                  </li>
                  <li>
                    • 发送垃圾信息、恶意骚扰、诈骗性消息或含有恶意代码的内容
                  </li>
                  <li>• 冒充他人、进行欺骗性注册或操纵账户</li>
                  <li>• 发布淫秽、暴力、恐怖、仇恨、歧视内容</li>
                  <li>• 侵犯他人著作权、商标权、专利权或商业秘密</li>
                  <li>• 侵害他人隐私、个人信息或肖像权</li>
                  <li>• 进行网络恐吓、性骚扰或人身攻击</li>
                  <li>• 试图破坏平台安全、进行DDoS攻击、SQL注入等恶意行为</li>
                  <li>• 发布虚假广告或误导性营销信息</li>
                  <li>• 任何其他违反法律法规或平台规则的行为</li>
                </ul>
              </section>

              {/* 4. 用户生成内容和知识产权 */}
              <section className="border-l-4 border-blue-500 pl-6 py-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  4. 用户生成内容和知识产权
                </h2>
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  关于用户内容的所有权和使用，明确如下：
                </p>
                <ul className="space-y-2 text-gray-700 dark:text-gray-300 ml-4">
                  <li>• 用户保留对自己创建的原始内容的所有权和著作权</li>
                  <li>
                    • 用户授予xPilot有限的、非独占的、免费许可来存储和处理内容
                  </li>
                  <li>
                    •
                    用户对发布到X、抖音、微博等社交平台的所有内容的合法性、真实性、不侵权性全权负责
                  </li>
                  <li>• AI生成内容自动转让给用户（包括其衍生作品）</li>
                  <li>
                    •
                    用户保证发布的内容不侵犯第三方知识产权，否则自行承担法律责任
                  </li>
                  <li>
                    •
                    xPilot对用户生成内容不进行预审、编辑或审核，不对内容真实性、合法性承担责任
                  </li>
                  <li>
                    •
                    用户发布的内容被第三方投诉时，xPilot有权暂停服务直到纠纷解决
                  </li>
                </ul>
              </section>

              {/* 5. AI内容生成与使用说明 */}
              <section className="border-l-4 border-blue-500 pl-6 py-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  5. AI内容生成与使用说明
                </h2>
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  xPilot通过OpenAI等第三方AI模型生成内容。用户必须理解以下内容：
                </p>
                <ul className="space-y-3 text-gray-700 dark:text-gray-300 ml-4">
                  <li>
                    • <strong>准确性无保证：</strong>{" "}
                    AI生成内容可能包含错误、过时信息或不当内容
                  </li>
                  <li>
                    • <strong>审核责任：</strong>{" "}
                    xPilot不保证内容准确性或适用性，用户必须自行审查并编辑后才能发布
                  </li>
                  <li>
                    • <strong>数据处理：</strong>{" "}
                    用户输入和AI生成内容会发送至OpenAI（美国服务器）进行处理，属于数据跨境转移
                  </li>
                  <li>
                    • <strong>法律责任：</strong>{" "}
                    因AI生成内容引起的纠纷（如侵权、诽谤）由用户承担全部法律责任
                  </li>
                  <li>
                    • <strong>知识产权：</strong>{" "}
                    用户发布AI生成内容前应确认不侵犯第三方权益
                  </li>
                </ul>
              </section>

              {/* 6. 第三方平台集成 */}
              <section className="border-l-4 border-blue-500 pl-6 py-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  6. 第三方社交平台集成
                </h2>
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  xPilot通过OAuth等方式与X、抖音、微博、小红书等第三方平台集成。用户同意以下条款：
                </p>
                <ul className="space-y-2 text-gray-700 dark:text-gray-300 ml-4">
                  <li>• xPilot非上述平台的官方应用或授权服务商</li>
                  <li>
                    • 用户向这些平台的使用受各自的《服务条款》和《隐私政策》约束
                  </li>
                  <li>• 用户授权xPilot代表用户发布、编辑、删除内容</li>
                  <li>
                    • xPilot不对第三方平台的服务中断、政策变更或功能障碍负责
                  </li>
                  <li>• 用户对发布的所有内容在第三方平台上的后果自行负责</li>
                  <li>• 第三方平台账户被冻结/禁言不属于xPilot责任范围</li>
                </ul>
              </section>

              {/* 7. 费用、支付和退款 */}
              <section className="border-l-4 border-blue-500 pl-6 py-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  7. 费用、支付、提现和退款政策
                </h2>

                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mt-4 mb-3">
                  7.1 订阅和API积分
                </h3>
                <ul className="space-y-2 text-gray-700 dark:text-gray-300 ml-4">
                  <li>• 订阅费按月或年计费，具体金额见订阅页面</li>
                  <li>
                    •
                    支持微信支付、支付宝、Stripe等多种支付方式，由正规支付服务商（Stripe, Inc.）处理
                  </li>
                  <li>
                    •
                    自动续费：除非用户在续费前72小时内主动取消，否则自动使用相同支付方式续费
                  </li>
                  <li>• 免费试用期结束后自动转为付费订阅（会提前通知）</li>
                  <li>
                    • <strong>API积分：</strong>{" "}
                    积分用于AI内容生成等平台功能，积分不可转让、不可兑换现金、不可提现。积分购买后不予退还（法律另有规定除外）
                  </li>
                  <li>
                    •
                    价格调整：xPilot可能随时调整费用，调整后的价格在30日后对新用户和续费用户生效
                  </li>
                  <li>• 发票：用户可申请开具增值税电子发票，由我们出具</li>
                </ul>

                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mt-6 mb-3">
                  7.2 活动付款和平台服务费
                </h3>
                <ul className="space-y-2 text-gray-700 dark:text-gray-300 ml-4">
                  <li>
                    • <strong>活动付款：</strong>{" "}
                    xPilot提供活动（Campaign）功能，允许用户创建推广活动并接受客户付款。客户通过Stripe支付的款项由xPilot代收
                  </li>
                  <li>
                    • <strong>平台服务费：</strong>{" "}
                    xPilot对每笔活动收入收取5%的平台服务费。该费用在提现时自动扣除
                  </li>
                  <li>
                    • <strong>Stripe手续费：</strong>{" "}
                    支付处理商Stripe收取的手续费（约2.9% + $0.30/笔）由收款方承担，xPilot不对此额外收费
                  </li>
                  <li>
                    •
                    活动收入与API积分是独立的系统，活动收入为现金收益，不可用于抵扣API积分
                  </li>
                </ul>

                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mt-6 mb-3">
                  7.3 提现和资金转出
                </h3>
                <ul className="space-y-2 text-gray-700 dark:text-gray-300 ml-4">
                  <li>
                    • <strong>提现方式：</strong>{" "}
                    xPilot支持两种提现方式：(1) Stripe Connect快捷提现（需完成Stripe身份验证），(2) ACH银行直接转账（需提供美国银行账户信息）
                  </li>
                  <li>
                    • <strong>Stripe Connect提现：</strong>{" "}
                    标准提现免费，预计2-3个工作日到账；即时提现收取1.5%手续费
                  </li>
                  <li>
                    • <strong>ACH银行转账：</strong>{" "}
                    免手续费，预计2-3个工作日到账。仅支持标准速度
                  </li>
                  <li>
                    • <strong>最低提现额：</strong>{" "}
                    最低提现金额为$1.00（美元）
                  </li>
                  <li>
                    • <strong>身份验证：</strong>{" "}
                    为遵守反洗钱（AML）和了解客户（KYC）法规，用户在设置提现方式时需提供真实身份信息。xPilot通过Stripe处理身份验证，不直接存储完整银行账号
                  </li>
                  <li>
                    • <strong>资金安全：</strong>{" "}
                    用户活动收入由Stripe托管，xPilot不直接持有用户资金。资金转出通过Stripe的安全支付基础设施完成
                  </li>
                  <li>
                    •
                    提现申请一经提交不可撤销。因银行信息错误导致的转账失败，xPilot不承担责任
                  </li>
                </ul>

                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mt-6 mb-3">
                  7.4 退款政策
                </h3>
                <ul className="space-y-2 text-gray-700 dark:text-gray-300 ml-4">
                  <li>
                    • <strong>订阅退款：</strong>{" "}
                    按照《消费者权益保护法》规定，自付款日起7日内可申请退款，超期不予退款（法律另有规定除外）
                  </li>
                  <li>
                    • <strong>活动付款退款：</strong>{" "}
                    客户对活动付款的退款请求需由活动创建者处理。xPilot不直接介入活动创建者和客户之间的退款纠纷
                  </li>
                  <li>
                    • <strong>已提现资金：</strong>{" "}
                    已成功提现到银行账户的资金不适用平台退款流程
                  </li>
                </ul>
              </section>

              {/* 8. 服务修改、中止和终止 */}
              <section className="border-l-4 border-blue-500 pl-6 py-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  8. 服务修改、中止和终止
                </h2>
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  xPilot保留以下权利：
                </p>
                <ul className="space-y-2 text-gray-700 dark:text-gray-300 ml-4">
                  <li>• 随时修改或中止部分或全部服务，但会提前30天通知用户</li>
                  <li>
                    • 因系统维护、紧急情况需要暂停服务，会尽最大努力通知用户
                  </li>
                  <li>
                    • 在用户违反本条款时，立即禁用账户并保留追究法律责任的权利
                  </li>
                  <li>
                    •
                    用户可随时提出注销账户申请，xPilot将在30天内删除个人数据（法律要求保留除外）
                  </li>
                  <li>• 服务中止期间的费用不予退还，除非因xPilot责任</li>
                </ul>
              </section>

              {/* 9. 知识产权保护 */}
              <section className="border-l-4 border-blue-500 pl-6 py-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  9. xPilot平台的知识产权
                </h2>
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  xPilot平台及其内容受《著作权法》《商标法》等知识产权法律保护：
                </p>
                <ul className="space-y-2 text-gray-700 dark:text-gray-300 ml-4">
                  <li>
                    •
                    xPilot公司拥有平台所有代码、设计、界面、功能的所有版权和商标权
                  </li>
                  <li>• 用户仅获得个人、非商业、不可转让的有限使用许可</li>
                  <li>• 严禁复制、修改、分发、租赁或分享平台代码和设计</li>
                  <li>• 严禁进行反向工程、反汇编、破解或绕过任何技术措施</li>
                  <li>• xPilot的商标和标志不得未经许可用于商业目的</li>
                  <li>• 任何侵权将由侵权人承担法律责任和赔偿责任</li>
                </ul>
              </section>

              {/* 10. 责任限制和免责声明 */}
              <section className="border-l-4 border-orange-500 pl-6 py-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  10. 责任限制和免责声明
                </h2>
                <div className="bg-orange-50 dark:bg-orange-900/30 rounded-lg border border-orange-200 dark:border-orange-800 p-4 mb-4 text-gray-700 dark:text-gray-300">
                  <p className="font-bold mb-2">
                    重要声明：xPilot按照"现状"（AS IS）提供服务。
                  </p>
                  <ul className="space-y-2 text-sm ml-4">
                    <li>
                      •
                      xPilot不提供任何明示或暗示的担保，包括适销性、特定用途适用性
                    </li>
                    <li>
                      •
                      xPilot对以下不承担任何责任：用户数据丢失、收入或利润损失、业务中断、间接损失或相应损害，即使已被告知可能性
                    </li>
                    <li>• 用户对使用平台引起的一切后果自行承担责任</li>
                    <li>
                      • <strong>责任上限：</strong>{" "}
                      xPilot的总责任赔偿上限为用户在过去12个月内支付的订阅费用总额
                    </li>
                  </ul>
                </div>
              </section>

              {/* 11. 不可抗力 */}
              <section className="border-l-4 border-blue-500 pl-6 py-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  11. 不可抗力事件
                </h2>
                <p className="text-gray-700 dark:text-gray-300">
                  因战争、恐怖袭击、自然灾害、政府行为、网络攻击、基础设施故障、通信中断等不可控因素导致的服务中断或延误，xPilot不承担违约责任。xPilot将在合理范围内采取措施恢复服务，但不承诺具体恢复时间。
                </p>
              </section>

              {/* 12. 纠纷解决 */}
              <section className="border-l-4 border-blue-500 pl-6 py-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  12. 纠纷解决和法律适用
                </h2>
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  关于本条款或服务的任何争议，应按以下程序解决：
                </p>
                <ul className="space-y-2 text-gray-700 dark:text-gray-300 ml-4">
                  <li>
                    • <strong>协商阶段：</strong>{" "}
                    双方首先尝试通过友好协商解决纠纷（期限30天）
                  </li>
                  <li>
                    • <strong>调解/仲裁：</strong>{" "}
                    协商失败，用户可申请中国国际经济贸易仲裁委员会进行仲裁
                  </li>
                  <li>
                    • <strong>诉讼：</strong>{" "}
                    仲裁失败或不适用，由上海市浦东新区人民法院具有管辖权
                  </li>
                  <li>
                    • <strong>法律适用：</strong>{" "}
                    本条款受中华人民共和国法律管辖，不适用国际私法原则
                  </li>
                  <li>
                    • <strong>时效：</strong>{" "}
                    用户向xPilot提出权利主张的诉讼时效为2年，自知道或应当知道权利被侵害之日起计算
                  </li>
                </ul>
              </section>

              {/* 13. 合规声明与其他条款 */}
              <section className="border-l-4 border-blue-500 pl-6 py-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  13. 合规声明与其他重要条款
                </h2>
                <ul className="space-y-2 text-gray-700 dark:text-gray-300 ml-4">
                  <li>
                    • <strong>内容审核：</strong>{" "}
                    xPilot不进行内容预审，但有权在收到举报后及时删除违法内容，并配合执法部门调查
                  </li>
                  <li>
                    • <strong>条款修改：</strong>{" "}
                    xPilot可随时修改本条款，修改后继续使用平台即表示接受新条款，建议定期查看
                  </li>
                  <li>
                    • <strong>完整协议：</strong>{" "}
                    本条款与《隐私政策》《免责声明》构成完整协议，前次版本作废
                  </li>
                  <li>
                    • <strong>可分割性：</strong>{" "}
                    若任何条款被认定无效或违法，其他条款继续有效
                  </li>
                  <li>
                    • <strong>第三方权利：</strong>{" "}
                    除支付服务商和API提供商外，任何第三方都无权执行本条款
                  </li>
                  <li>
                    • <strong>信息公开：</strong>{" "}
                    xPilot会配合《网络安全法》《数据安全法》等要求，向政府部门提交用户数据（如有法律强制要求）
                  </li>
                </ul>
              </section>
            </>
          ) : (
            <>
              {/* English Version */}
              <section className="border-l-4 border-blue-500 pl-6 py-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  1. Acceptance of Terms
                </h2>
                <p className="text-gray-700 dark:text-gray-300">
                  By accessing and using xPilot (https://xpilot.app), you agree
                  to be bound by these Terms of Service. If you do not agree, do
                  not use the platform. These terms are governed by the laws of
                  the State of California, USA, and disputes shall be resolved
                  through binding arbitration or court proceedings in San
                  Francisco, California.
                </p>
              </section>

              <section className="border-l-4 border-blue-500 pl-6 py-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  2. Account Management & User Responsibility
                </h2>
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  You are solely responsible for your account security and
                  activity. You must:
                </p>
                <ul className="space-y-2 text-gray-700 dark:text-gray-300 ml-4">
                  <li>
                    • Provide accurate, true information during registration
                  </li>
                  <li>
                    • Maintain confidentiality of your password and API keys
                  </li>
                  <li>• Report unauthorized access immediately</li>
                  <li>• Monitor account activity regularly</li>
                  <li>
                    • Accept full legal responsibility for all account
                    activities
                  </li>
                  <li>• Not share, rent, or transfer your account</li>
                </ul>
              </section>

              <section className="border-l-4 border-blue-500 pl-6 py-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  3. Prohibited Content & Usage
                </h2>
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  You may not use xPilot to:
                </p>
                <ul className="space-y-2 text-gray-700 dark:text-gray-300 ml-4">
                  <li>
                    • Post illegal, harmful, defamatory, or obscene content
                  </li>
                  <li>
                    • Engage in fraud, scams, money laundering, or illegal
                    gambling
                  </li>
                  <li>• Send spam, harassment, or malicious code</li>
                  <li>• Impersonate others or engage in deception</li>
                  <li>
                    • Publish violent, hateful, or discriminatory material
                  </li>
                  <li>
                    • Infringe intellectual property, trademark, or patent
                    rights
                  </li>
                  <li>
                    • Violate privacy, personal information, or likeness rights
                  </li>
                  <li>
                    • Conduct cyberstalking, sexual harassment, or personal
                    attacks
                  </li>
                  <li>
                    • Compromise platform security via DDoS, SQL injection, or
                    hacking
                  </li>
                  <li>• Post false advertising or misleading marketing</li>
                  <li>• Any other illegal or rule-violating activity</li>
                </ul>
              </section>

              <section className="border-l-4 border-blue-500 pl-6 py-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  4. Content Ownership & Intellectual Property
                </h2>
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  Regarding user-generated content ownership and usage:
                </p>
                <ul className="space-y-2 text-gray-700 dark:text-gray-300 ml-4">
                  <li>
                    • You retain ownership and copyright of your original
                    content
                  </li>
                  <li>
                    • You grant xPilot a limited, non-exclusive license to store
                    and process content
                  </li>
                  <li>
                    • You are solely responsible for the legality and
                    non-infringement of published content
                  </li>
                  <li>
                    • AI-generated content automatically transfers to you
                    including derivatives
                  </li>
                  <li>
                    • You warrant content does not infringe third-party rights
                  </li>
                  <li>
                    • xPilot does not review, edit, or verify user content and
                    assumes no liability
                  </li>
                  <li>
                    • xPilot may suspend service if third parties claim
                    copyright infringement
                  </li>
                </ul>
              </section>

              <section className="border-l-4 border-blue-500 pl-6 py-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  5. AI Features & Content Generation
                </h2>
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  xPilot uses AI models (OpenAI, etc.) to generate content. You
                  acknowledge:
                </p>
                <ul className="space-y-3 text-gray-700 dark:text-gray-300 ml-4">
                  <li>
                    • <strong>No Accuracy Guarantee:</strong> AI content may be
                    incorrect, outdated, or inappropriate
                  </li>
                  <li>
                    • <strong>Your Review Responsibility:</strong> xPilot does
                    not warrant accuracy; you must review before publishing
                  </li>
                  <li>
                    • <strong>Data Processing:</strong> Your input and AI output
                    are sent to OpenAI (US servers) for processing
                  </li>
                  <li>
                    • <strong>Legal Liability:</strong> You bear full
                    responsibility for any infringement, defamation, or misuse
                  </li>
                  <li>
                    • <strong>IP Verification:</strong> Verify AI content does
                    not infringe third-party rights before publishing
                  </li>
                </ul>
              </section>

              <section className="border-l-4 border-blue-500 pl-6 py-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  6. Social Media Platform Integration
                </h2>
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  xPilot integrates with X, TikTok, Instagram, Weibo, and other
                  platforms. You agree:
                </p>
                <ul className="space-y-2 text-gray-700 dark:text-gray-300 ml-4">
                  <li>
                    • xPilot is not affiliated with or endorsed by these
                    platforms
                  </li>
                  <li>
                    • Your platform use is governed by their own terms and
                    policies
                  </li>
                  <li>
                    • You authorize xPilot to post, edit, and delete content on
                    your behalf
                  </li>
                  <li>
                    • xPilot is not liable for platform downtime, policy
                    changes, or feature changes
                  </li>
                  <li>
                    • You assume full responsibility for content published to
                    third-party platforms
                  </li>
                  <li>
                    • Account suspension on third-party platforms is not
                    xPilot's responsibility
                  </li>
                </ul>
              </section>

              <section className="border-l-4 border-blue-500 pl-6 py-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  7. Fees, Payments, Withdrawals & Refunds
                </h2>

                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mt-4 mb-3">
                  7.1 Subscriptions & API Credits
                </h3>
                <ul className="space-y-2 text-gray-700 dark:text-gray-300 ml-4">
                  <li>• Fees are billed monthly or annually as selected</li>
                  <li>• Payment processed securely by Stripe, Inc.</li>
                  <li>
                    • Auto-renewal unless canceled 72 hours before renewal
                  </li>
                  <li>
                    • Free trials convert to paid subscriptions automatically
                  </li>
                  <li>
                    • <strong>API Credits:</strong> Credits are used for AI
                    content generation and other platform features. Credits are
                    non-transferable, non-exchangeable for cash, and
                    non-withdrawable. Purchased credits are non-refundable
                    except as required by applicable law
                  </li>
                  <li>
                    • Price changes effective 30 days after notice for
                    new/renewing customers
                  </li>
                  <li>• Invoices available upon request</li>
                </ul>

                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mt-6 mb-3">
                  7.2 Campaign Payments & Platform Fees
                </h3>
                <ul className="space-y-2 text-gray-700 dark:text-gray-300 ml-4">
                  <li>
                    • <strong>Campaign Payments:</strong> xPilot enables users to
                    create promotional campaigns and accept client payments.
                    Client payments are processed and held by Stripe on behalf
                    of xPilot
                  </li>
                  <li>
                    • <strong>Platform Fee:</strong> xPilot charges a 5% platform
                    service fee on each campaign earning, deducted automatically
                    upon withdrawal
                  </li>
                  <li>
                    • <strong>Stripe Processing Fee:</strong> Stripe's payment
                    processing fee (approximately 2.9% + $0.30 per transaction)
                    is borne by the payee; xPilot does not charge additional
                    processing fees
                  </li>
                  <li>
                    • Campaign earnings (cash) and API Credits are separate
                    systems; campaign earnings cannot be used to offset API
                    Credits
                  </li>
                </ul>

                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mt-6 mb-3">
                  7.3 Withdrawals & Fund Disbursement
                </h3>
                <ul className="space-y-2 text-gray-700 dark:text-gray-300 ml-4">
                  <li>
                    • <strong>Withdrawal Methods:</strong> xPilot supports two
                    withdrawal methods: (1) Stripe Connect (requires Stripe
                    identity verification), (2) ACH Direct Bank Transfer
                    (requires US bank account details)
                  </li>
                  <li>
                    • <strong>Stripe Connect:</strong> Standard withdrawal is
                    free (2-3 business days); Instant withdrawal incurs a 1.5%
                    fee
                  </li>
                  <li>
                    • <strong>ACH Bank Transfer:</strong> Free of charge, 2-3
                    business days. Standard speed only
                  </li>
                  <li>
                    • <strong>Minimum Withdrawal:</strong> $1.00 USD
                  </li>
                  <li>
                    • <strong>Identity Verification:</strong> To comply with
                    Anti-Money Laundering (AML) and Know Your Customer (KYC)
                    regulations, users must provide valid identity information
                    when setting up withdrawal methods. xPilot processes
                    identity verification through Stripe and does not directly
                    store full bank account numbers
                  </li>
                  <li>
                    • <strong>Fund Custody:</strong> Campaign earnings are held
                    by Stripe; xPilot does not directly hold user funds. Fund
                    transfers are executed through Stripe's secure payment
                    infrastructure
                  </li>
                  <li>
                    • Withdrawal requests are irrevocable once submitted. xPilot
                    is not responsible for transfer failures caused by incorrect
                    bank information
                  </li>
                </ul>

                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mt-6 mb-3">
                  7.4 Refund Policy
                </h3>
                <ul className="space-y-2 text-gray-700 dark:text-gray-300 ml-4">
                  <li>
                    • <strong>Subscription Refunds:</strong> Refunds permitted
                    within 7 days of purchase under applicable law; otherwise
                    non-refundable
                  </li>
                  <li>
                    • <strong>Campaign Payment Refunds:</strong> Refund requests
                    for campaign payments must be handled by the campaign
                    creator. xPilot does not directly mediate refund disputes
                    between campaign creators and clients
                  </li>
                  <li>
                    • <strong>Withdrawn Funds:</strong> Funds successfully
                    withdrawn to a bank account are not subject to platform
                    refund processes
                  </li>
                </ul>
              </section>

              <section className="border-l-4 border-blue-500 pl-6 py-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  8. Service Modification & Termination
                </h2>
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  xPilot reserves the right to:
                </p>
                <ul className="space-y-2 text-gray-700 dark:text-gray-300 ml-4">
                  <li>• Modify or discontinue services with 30 days' notice</li>
                  <li>
                    • Temporarily suspend for maintenance or security purposes
                  </li>
                  <li>• Immediately suspend accounts violating these terms</li>
                  <li>
                    • Accept account deletion requests (data removed within 30
                    days unless legally required)
                  </li>
                  <li>
                    • No refunds for suspended services unless caused by xPilot
                  </li>
                </ul>
              </section>

              <section className="border-l-4 border-blue-500 pl-6 py-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  9. xPilot Intellectual Property Rights
                </h2>
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  The platform and its content are protected by copyright and
                  trademark law:
                </p>
                <ul className="space-y-2 text-gray-700 dark:text-gray-300 ml-4">
                  <li>
                    • xPilot owns all platform code, design, interface, and
                    functionality
                  </li>
                  <li>
                    • You receive limited, personal, non-commercial,
                    non-transferable license
                  </li>
                  <li>
                    • Reproduction, modification, distribution, or rental is
                    prohibited
                  </li>
                  <li>
                    • Reverse engineering, decompiling, or circumventing
                    protections is prohibited
                  </li>
                  <li>
                    • xPilot trademarks may not be used without permission
                  </li>
                  <li>
                    • Infringement will result in legal action and damages
                  </li>
                </ul>
              </section>

              <section className="border-l-4 border-orange-500 pl-6 py-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  10. Limitation of Liability
                </h2>
                <div className="bg-orange-50 dark:bg-orange-900/30 rounded-lg border border-orange-200 dark:border-orange-800 p-4 mb-4 text-gray-700 dark:text-gray-300">
                  <p className="font-bold mb-2">
                    xPilot is provided "AS IS" without warranties or conditions.
                  </p>
                  <ul className="space-y-2 text-sm ml-4">
                    <li>
                      • No express or implied warranties of merchantability or
                      fitness
                    </li>
                    <li>
                      • xPilot not liable for data loss, lost revenue, business
                      interruption, or indirect damages
                    </li>
                    <li>• You assume all risk from using the platform</li>
                    <li>
                      • <strong>Liability Cap:</strong> Maximum liability
                      limited to fees paid in past 12 months
                    </li>
                  </ul>
                </div>
              </section>

              <section className="border-l-4 border-blue-500 pl-6 py-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  11. Force Majeure
                </h2>
                <p className="text-gray-700 dark:text-gray-300">
                  xPilot is not liable for service disruptions caused by war,
                  terrorism, natural disasters, government action, cyberattacks,
                  or infrastructure failures beyond reasonable control. We
                  strive to restore service but make no timeline promises.
                </p>
              </section>

              <section className="border-l-4 border-blue-500 pl-6 py-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  12. Dispute Resolution & Arbitration
                </h2>
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  Any disputes shall be resolved as follows:
                </p>
                <ul className="space-y-2 text-gray-700 dark:text-gray-300 ml-4">
                  <li>
                    • <strong>Negotiation:</strong> Good faith negotiation for
                    30 days
                  </li>
                  <li>
                    • <strong>Arbitration:</strong> If negotiation fails,
                    binding arbitration in San Francisco under AAA rules
                  </li>
                  <li>
                    • <strong>Litigation:</strong> If arbitration unavailable,
                    jurisdiction in San Francisco Superior Court
                  </li>
                  <li>
                    • <strong>Governing Law:</strong> California law applies; no
                    international private law rules
                  </li>
                  <li>
                    • <strong>Statute of Limitations:</strong> 2 years from
                    discovery of harm
                  </li>
                </ul>
              </section>

              <section className="border-l-4 border-blue-500 pl-6 py-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  13. Compliance & Miscellaneous
                </h2>
                <ul className="space-y-2 text-gray-700 dark:text-gray-300 ml-4">
                  <li>
                    • <strong>Content Moderation:</strong> xPilot does not
                    pre-review content but may remove illegal content upon
                    notice
                  </li>
                  <li>
                    • <strong>Term Updates:</strong> We may modify these terms;
                    continued use constitutes acceptance
                  </li>
                  <li>
                    • <strong>Entire Agreement:</strong> This terms, Privacy
                    Policy, and Disclaimer form the complete agreement
                  </li>
                  <li>
                    • <strong>Severability:</strong> Invalid provisions do not
                    affect other terms
                  </li>
                  <li>
                    • <strong>Third-Party Rights:</strong> Only you and xPilot
                    are parties (except payment processors)
                  </li>
                  <li>
                    • <strong>Government Compliance:</strong> xPilot may
                    disclose user data to government if legally required
                  </li>
                </ul>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
