import Link from "next/link";

export default function NotFound() {
  return (
    <main className="not-found">
      <span className="eyebrow">404</span>
      <h1>Workspace not available</h1>
      <p>The page does not exist or your account cannot access it.</p>
      <Link className="primary-button inline" href="/dashboard">Return to dashboard</Link>
    </main>
  );
}
