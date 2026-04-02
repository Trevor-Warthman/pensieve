import Link from "next/link";

export default function SetupPage() {
  return (
    <main className="flex min-h-screen flex-col px-6 py-16 max-w-2xl mx-auto">
      <Link
        href="/dashboard"
        className="text-sm text-gray-500 hover:text-gray-300 transition-colors mb-10 inline-block"
      >
        ← Back to Dashboard
      </Link>

      <div className="mb-10">
        <p className="text-sm text-gray-500 uppercase tracking-widest mb-2">Setup Guide</p>
        <h1 className="text-4xl font-bold text-white">Installing the CLI</h1>
        <p className="text-gray-400 mt-3">
          No coding experience needed. This takes about 5 minutes.
        </p>
      </div>

      <div className="space-y-10">
        <Section number={1} title="Install Node.js">
          <p className="text-gray-400 text-sm">
            The Pensieve CLI runs on Node.js. If you&apos;ve never heard of it, that&apos;s fine
            — it&apos;s just a small program your computer needs.
          </p>
          <ol className="mt-4 space-y-2 text-sm text-gray-400 list-decimal list-inside">
            <li>
              Go to{" "}
              <span className="text-gray-300 font-mono">nodejs.org</span> and click the{" "}
              <strong className="text-white">LTS</strong> download button.
            </li>
            <li>Open the downloaded file and follow the installer steps.</li>
            <li>When it finishes, continue to step 2.</li>
          </ol>
        </Section>

        <Section number={2} title="Open a Terminal">
          <p className="text-gray-400 text-sm">
            A terminal lets you run short text commands. You only need it for the next two steps.
          </p>
          <div className="mt-4 space-y-3">
            <OS label="Mac">
              Press <Kbd>⌘</Kbd> + <Kbd>Space</Kbd>, type <strong className="text-white">Terminal</strong>, press <Kbd>Enter</Kbd>.
            </OS>
            <OS label="Windows">
              Press <Kbd>Win</Kbd> + <Kbd>R</Kbd>, type <strong className="text-white">cmd</strong>, press <Kbd>Enter</Kbd>.
            </OS>
            <OS label="Linux">
              Press <Kbd>Ctrl</Kbd> + <Kbd>Alt</Kbd> + <Kbd>T</Kbd>.
            </OS>
          </div>
        </Section>

        <Section number={3} title="Install the Pensieve CLI">
          <p className="text-gray-400 text-sm">
            In the terminal window, paste this command and press <Kbd>Enter</Kbd>:
          </p>
          <Pre code="npm install -g pensieve-cli" className="mt-4" />
          <p className="text-xs text-gray-600 mt-2">
            It will print a few lines. That&apos;s normal — wait for it to finish.
          </p>
        </Section>

        <Section number={4} title="Sync Your Notes">
          <p className="text-gray-400 text-sm">
            Navigate your terminal to the folder where your notes live, then run:
          </p>
          <Pre code="pensieve sync ./your-notes --lexicon your-slug" className="mt-4" />
          <p className="text-xs text-gray-600 mt-2">
            Replace <code className="text-gray-500">your-notes</code> with your actual folder name
            and <code className="text-gray-500">your-slug</code> with the slug you chose when
            creating your Lexicon.
          </p>
          <details className="mt-4 group">
            <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-300 transition-colors select-none">
              How do I navigate to my folder?
            </summary>
            <div className="mt-3 space-y-2 text-xs text-gray-500 border-l border-gray-800 pl-4">
              <p>
                Use the <code className="text-gray-400">cd</code> command to move into a folder.
                For example, if your notes are in a folder called{" "}
                <code className="text-gray-400">Obsidian</code> on your Desktop:
              </p>
              <Pre code="cd ~/Desktop/Obsidian" />
              <p>Then run the sync command from there.</p>
            </div>
          </details>
        </Section>
      </div>

      <div className="mt-12 pt-8 border-t border-gray-800">
        <Link
          href="/dashboard"
          className="px-4 py-2 rounded bg-white text-gray-950 text-sm font-medium hover:bg-gray-100 transition-colors"
        >
          Back to Dashboard
        </Link>
      </div>
    </main>
  );
}

function Section({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-5">
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-xs font-medium text-gray-400 mt-0.5">
        {number}
      </div>
      <div className="min-w-0">
        <h2 className="text-lg font-semibold text-white mb-3">{title}</h2>
        {children}
      </div>
    </div>
  );
}

function OS({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3 text-sm">
      <span className="flex-shrink-0 text-xs font-medium text-gray-600 w-14">{label}</span>
      <span className="text-gray-400">{children}</span>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="px-1.5 py-0.5 rounded bg-gray-800 border border-gray-700 text-gray-300 text-xs font-mono">
      {children}
    </kbd>
  );
}

function Pre({ code, className }: { code: string; className?: string }) {
  return (
    <div className={`rounded bg-gray-900 border border-gray-800 px-4 py-3 ${className ?? ""}`}>
      <code className="text-sm text-gray-300 font-mono">{code}</code>
    </div>
  );
}
