import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="border-t border-white/[.06] py-8 text-center text-xs text-zinc-500">
      <p>
        Built by Tejdeep Kellampalli · Map data © OpenStreetMap contributors · Routing by OSRM · Search by Nominatim
      </p>
      <p className="mt-1">
        Demo media from Wikimedia Commons (credits on the <Link to="/about" className="underline hover:text-zinc-300">about page</Link>)
      </p>
    </footer>
  );
}
