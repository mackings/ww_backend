"use client";

import Link from "next/link";

export function AuthCard({ title, subtitle, children, footer }) {
  return (
    <>
      <link rel="preload" href="/images/woodwork-login-hero.jpg" as="image" type="image/jpeg" fetchPriority="high" />
      <main className="auth-page">
        <section className="auth-story">
          <div className="brand light">
            <span className="brand-mark">W</span>
            <span><strong>WoodWork</strong></span>
          </div>
          <div>
            <span className="eyebrow light-text">Built for production teams</span>
            <h1>From material cost to completed order.</h1>
            <p>One focused workspace for quotations, production data, sales, staff and platform approvals.</p>
          </div>
        </section>
        <section className="auth-form-wrap">
          <div className="auth-card">
            <span className="eyebrow">Secure access</span>
            <h2>{title}</h2>
            <p>{subtitle}</p>
            {children}
            <div className="auth-footer">
              {footer.text} <Link href={footer.href}>{footer.label}</Link>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
