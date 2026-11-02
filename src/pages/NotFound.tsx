import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <section className="mx-auto grid min-h-[70vh] max-w-xl place-items-center px-6 text-center">
      <div>
        <div className="hazard-stripes mx-auto mb-8 h-3 w-40 rounded-full opacity-80" />
        <p className="font-display text-7xl font-bold text-white">404</p>
        <h1 className="mt-3 text-2xl font-semibold">Road closed</h1>
        <p className="mt-2 text-zinc-400">This page doesn&apos;t exist. Maybe it fell into a pothole.</p>
        <Link to="/" className="btn-primary mt-8">
          Back to home
        </Link>
      </div>
    </section>
  );
}
