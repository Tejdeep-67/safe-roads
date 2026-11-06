import { Link } from 'react-router-dom';
import { Download, Github, ScanSearch } from 'lucide-react';
import Sheet from './Sheet';
import Logo from './Logo';

export default function AboutPanel({ onClose, onGetApp }: { onClose: () => void; onGetApp?: () => void }) {
  return (
    <Sheet label="About Safe Roads" title="About Safe Roads" onClose={onClose}>
      <div className="space-y-4 text-[14px] leading-relaxed text-ink">
        <div className="flex items-center gap-3">
          <Logo size={44} />
          <p className="text-muted">A shared map of potholes, reported by people with a photo and checked by a small AI model that runs on your phone.</p>
        </div>
        <section>
          <h3 className="font-semibold">How it works</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-muted">
            <li>Take a photo of a pothole. A YOLOv8 segmentation model runs right in your browser (ONNX Runtime Web, in a Web Worker) and draws boxes around what it finds.</li>
            <li>The location comes from the photo's GPS, your phone's GPS, or you place it on the map.</li>
            <li>Plan a drive and see the potholes within 30 m of your route. Drive mode warns you with voice and vibration as you get close.</li>
          </ul>
        </section>
        <section>
          <h3 className="font-semibold">How good is the model?</h3>
          <p className="mt-1 text-muted">
            It's a YOLOv8n-seg model fine-tuned on a public pothole dataset (not trained by me). I tested it on 100 images it had never seen (Roboflow
            “Potholes Detection” test split, 269 potholes): mAP50 0.34, precision 0.68, recall 0.28 at 640 px. So when it finds something it's usually right, but it
            misses many potholes, mostly small or far ones. That's why you can always report without it.
          </p>
        </section>
        <section>
          <h3 className="font-semibold">Your account</h3>
          <p className="mt-1 text-muted">
            Viewing the map needs no account. To report you sign in, so reports can be deleted by the person who made them. Passwords are hashed with scrypt; the
            session is a signed, httpOnly cookie. Others only see your first name.
          </p>
        </section>
        <section>
          <h3 className="font-semibold">Credits</h3>
          <p className="mt-1 text-muted">
            Map data and tiles © OpenStreetMap contributors, search by Photon (komoot) and Nominatim, routes by OSRM. Every pin on the map is a real report from a real
            account; there is no sample data. The optional "Road bumps from OpenStreetMap" layer shows speed bumps that mapmakers recorded in OpenStreetMap
            (ODbL licence), it is not made of Safe Roads reports.
          </p>
        </section>
        <div className="flex flex-wrap gap-2 pt-1">
          {onGetApp && (
            <button className="btn-primary" onClick={onGetApp}>
              <Download className="h-4 w-4" /> Get the app
            </button>
          )}
          <Link to="/detect" className="btn-tonal">
            <ScanSearch className="h-4 w-4" /> Detection demo
          </Link>
          <a href="https://github.com/Tejdeep-67/safe-roads" target="_blank" rel="noreferrer" className="btn-outline">
            <Github className="h-4 w-4" /> Source code
          </a>
        </div>
        <p className="text-xs text-faint">Made by Tejdeep Kellampalli, B.Tech CSE (Data Science), RVR &amp; JC College of Engineering, Guntur.</p>
      </div>
    </Sheet>
  );
}
