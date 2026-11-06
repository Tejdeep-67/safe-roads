// "Get the app": the Android APK download plus how to install the website as an app
// on iPhone / computer (it's a PWA, so it works without any store).
import { useEffect, useState } from 'react';
import { Download, MonitorSmartphone, Smartphone } from 'lucide-react';
import Sheet from './Sheet';
import { APK_SIZE, APK_URL, RELEASE_URL, canPromptInstall, isIOS, isStandalone, onInstallChange, promptInstall } from '../lib/install';

export default function GetAppPanel({ onClose }: { onClose: () => void }) {
  const [canInstall, setCanInstall] = useState(canPromptInstall);
  useEffect(() => onInstallChange(() => setCanInstall(canPromptInstall())), []);
  const ios = isIOS();

  const android = (
    <section className="rounded-2xl border border-line p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-600/20 dark:text-brand-200">
          <Smartphone className="h-5 w-5" />
        </span>
        <div>
          <h3 className="font-semibold text-ink">Android app</h3>
          <p className="text-sm text-muted">Version 1.0.0 · APK · {APK_SIZE}</p>
        </div>
      </div>
      <a href={APK_URL} className="btn-primary mt-4 w-full py-3 text-[15px]">
        <Download className="h-5 w-5" /> Download Android app ({APK_SIZE})
      </a>
      <p className="mt-3 text-[13px] leading-snug text-muted">
        It's not on the Play Store yet, so when you open the file Android asks to allow installs from this source (Chrome or Files). Allow it once, then tap Install.
      </p>
      <a href={RELEASE_URL} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[13px] font-medium text-brand-600 dark:text-brand-200">
        Release notes on GitHub
      </a>
    </section>
  );

  const pwa = (
    <section className="rounded-2xl border border-line p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sunken text-ink">
          <MonitorSmartphone className="h-5 w-5" />
        </span>
        <div>
          <h3 className="font-semibold text-ink">iPhone or computer</h3>
          <p className="text-sm text-muted">Install this website as an app, no download</p>
        </div>
      </div>
      {isStandalone() ? (
        <p className="mt-3 text-[14px] text-ink">You're already using it as an app.</p>
      ) : (
        <>
          {canInstall && (
            <button className="btn-tonal mt-4 w-full py-3" onClick={() => promptInstall()}>
              Install Safe Roads
            </button>
          )}
          <ul className="mt-3 space-y-1.5 text-[13px] leading-snug text-muted">
            <li>
              <b className="text-ink">iPhone (Safari):</b> tap Share, then <i>Add to Home Screen</i>.
            </li>
            <li>
              <b className="text-ink">Chrome / Edge on a computer:</b> click the install icon at the right end of the address bar.
            </li>
          </ul>
        </>
      )}
    </section>
  );

  return (
    <Sheet label="Get the app" title="Get the app" subtitle="Report road hazards and get warned on your drive, right from your home screen." onClose={onClose}>
      <div className="space-y-3 pt-1">
        {/* on an iPhone the install steps matter more, so show them first */}
        {ios ? (
          <>
            {pwa}
            {android}
          </>
        ) : (
          <>
            {android}
            {pwa}
          </>
        )}
      </div>
    </Sheet>
  );
}
