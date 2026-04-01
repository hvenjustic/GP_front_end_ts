import type { ComponentType, ReactNode } from 'react';
import type { Metadata } from 'next';
import { FiArrowUpRight, FiMessageCircle, FiSend, FiShield, FiSlack, FiUsers } from 'react-icons/fi';

export const metadata: Metadata = {
  title: 'Chat | Context'
};

const chatFeatures = [
  { title: 'Thread-aware memory', description: 'Every response is grounded in the current thread with traceable sources.', icon: FiMessageCircle },
  { title: 'Hand-off ready', description: 'Escalate to humans with a full summary and suggested next steps.', icon: FiUsers },
  { title: 'Safety first', description: 'Toxicity filters, PII redaction, and action approvals baked in.', icon: FiShield },
  { title: 'Works where you do', description: 'Embed the chat widget or connect Slack to keep the flow familiar.', icon: FiSlack }
];

const MessageBubble = ({
  sender,
  tone,
  children
}: {
  sender: 'User' | 'Assistant';
  tone?: 'accent';
  children: ReactNode;
}) => (
  <div
    className={`max-w-xl rounded-2xl px-4 py-3 text-sm shadow-sm ${
      sender === 'Assistant'
        ? 'bg-indigo-50 text-slate-800 dark:bg-indigo-900/30 dark:text-indigo-50'
        : 'bg-white text-slate-900 dark:bg-slate-800 dark:text-slate-100'
    } ${tone === 'accent' ? 'border border-indigo-200 dark:border-indigo-800/70' : ''}`}
  >
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{sender}</p>
    <div className="mt-1 space-y-1 text-sm leading-relaxed">{children}</div>
  </div>
);

const FeatureCard = ({
  title,
  description,
  icon: Icon
}: {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
}) => (
  <div className="glass-panel rounded-2xl border border-white/60 bg-white/70 p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/70">
    <div className="flex items-start gap-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-200">
        <Icon className="h-5 w-5" />
      </span>
      <div className="space-y-1">
        <p className="text-base font-semibold text-slate-900 dark:text-white">{title}</p>
        <p className="text-sm text-slate-600 dark:text-slate-300">{description}</p>
      </div>
    </div>
  </div>
);

export default function ChatPage() {
  return (
    <div className="relative isolate px-6 pb-16">
      <section className="mx-auto mt-8 max-w-[108rem] overflow-hidden rounded-3xl border border-white/60 bg-white/70 p-8 shadow-lg backdrop-blur md:p-12 dark:border-white/10 dark:bg-slate-900/80">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="space-y-4">
            <span className="inline-flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-200">
              <FiSend className="h-4 w-4" />
              Chat
            </span>
            <div className="space-y-3">
              <h1 className="text-3xl font-semibold leading-tight text-slate-900 dark:text-white md:text-4xl">
                An AI chat surface that keeps the team in the loop.
              </h1>
              <p className="max-w-2xl text-lg text-slate-600 dark:text-slate-300">
                Bring conversational workflows to your customers or teammates. Responses stay grounded,
                actions are approved, and every exchange is logged.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a
                href="#features"
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:-translate-y-0.5 hover:bg-indigo-500"
              >
                Browse features
                <FiArrowUpRight className="h-4 w-4" />
              </a>
              <a
                href="#transcript"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-slate-300 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-600"
              >
                Preview transcript
              </a>
            </div>
          </div>
          <div className="glass-panel space-y-3 rounded-2xl border border-gray-200/60 bg-white/70 p-5 text-sm shadow-sm dark:border-gray-800/60 dark:bg-slate-900/70">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400" id="transcript">
              Conversation preview
            </p>
            <div className="space-y-3">
              <MessageBubble sender="User">Can you summarize the latest release for the mobile app?</MessageBubble>
              <MessageBubble sender="Assistant">
                I pulled the 1.12 release notes and telemetry:
                <ul className="list-disc pl-5">
                  <li>Performance up 12% on cold start.</li>
                  <li>Crash rate down from 1.6% to 0.9%.</li>
                  <li>Top feedback: search bar still slow on older devices.</li>
                </ul>
              </MessageBubble>
              <MessageBubble sender="User">Draft an announcement for the #mobile channel.</MessageBubble>
              <MessageBubble sender="Assistant" tone="accent">
                Here&apos;s a short announcement. Send it to #mobile? (needs approval)
                <div className="mt-2 rounded-xl bg-white/70 px-3 py-2 text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100">
                  Shipping v1.12 today! Faster cold starts (+12%), crash rate down to 0.9%, and UI polish on
                  search. Please report slow search on older devices in this thread.
                </div>
              </MessageBubble>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-10 max-w-[108rem]" id="features">
        <div className="mb-4 flex items-center gap-2">
          <FiMessageCircle className="h-4 w-4 text-indigo-500" />
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Chat capabilities</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {chatFeatures.map((item) => (
            <FeatureCard key={item.title} title={item.title} description={item.description} icon={item.icon} />
          ))}
        </div>
      </section>
    </div>
  );
}
