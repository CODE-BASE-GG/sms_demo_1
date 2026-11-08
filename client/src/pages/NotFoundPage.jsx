import { Link } from 'react-router-dom';
import { ArrowLeft, Sun } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="not-found">
      <span className="not-found-sun">
        <Sun size={54} strokeWidth={1.8} />
      </span>
      <span className="not-found-code">404</span>
      <h1>This page wandered off campus.</h1>
      <p>The address you followed does not exist. Let&apos;s get you back to the sunshine.</p>
      <Link to="/" className="btn btn-primary">
        <ArrowLeft size={17} />
        Back to dashboard
      </Link>
    </div>
  );
}
