"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { WorkspaceIcon } from "@/features/navigation/components/workspace-icon";
import { useAuth } from "@/features/auth/context/auth-context";

const features = [
  ["materials", "Materials", "Keep approved materials, dimensions, images, variants and pricing organized."],
  ["quotations", "Quotations", "Turn customer requirements into clear estimates backed by real material costs."],
  ["boms", "Bill of Materials", "Calculate material quantities, standard sheet usage, overhead and selling price."],
  ["orders", "Orders", "Move approved work from quotation into production and payment tracking."],
  ["sales", "Sales & Inventory", "Follow revenue, customers, stock movement and business performance."],
  ["invoices", "Invoices", "Create invoices from completed work and track balances through settlement."]
];

const slides = [
  {
    eyebrow: "Materials",
    title: "Price every job from the materials you actually use.",
    copy: "Upload material images, record supplier sizes and pricing units, then use approved records when building a job.",
    icon: "materials",
    visual: "catalog"
  },
  {
    eyebrow: "Bill of Materials",
    title: "Know the cost before production begins.",
    copy: "Calculate area-based and quantity-based materials, add overhead, set margins and attach the finished product.",
    icon: "boms",
    visual: "bom"
  },
  {
    eyebrow: "Quotations to payment",
    title: "Keep the customer journey in one place.",
    copy: "Create the quotation, confirm the order, issue the invoice and monitor what has been paid or remains outstanding.",
    icon: "invoices",
    visual: "sales"
  }
];

const steps = [
  ["01", "Add your materials", "Create an approved library with images, dimensions, colors, units and prices."],
  ["02", "Build and price", "Combine materials into a product, calculate costs and apply your margin."],
  ["03", "Send the quotation", "Prepare a customer-ready quotation from the completed Bill of Materials."],
  ["04", "Deliver and collect", "Track the order, invoice the customer and record payment."]
];

export function LandingScreen() {
  const { token, ready } = useAuth();
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setSlide((current) => (current + 1) % slides.length), 6500);
    return () => window.clearInterval(timer);
  }, []);

  const appHref = ready && token ? "/dashboard" : "/signup";
  const appLabel = ready && token ? "Open dashboard" : "Create account";

  return (
    <main className="landing-page">
      <header className="landing-nav">
        <Link className="brand" href="/">
          <span className="brand-mark">W</span>
          <span><strong>WoodWork</strong></span>
        </Link>
        <nav>
          <a href="#features">Features</a>
          <a href="#workflow">How it works</a>
          <a href="#about">Why WoodWork</a>
        </nav>
        <div className="landing-nav-actions">
          {!token && <Link className="landing-signin" href="/login">Sign in</Link>}
          <Link className="landing-button small" href={appHref}>{appLabel}</Link>
        </div>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-copy">
          <span className="landing-kicker"><i /> Built for furniture and production teams</span>
          <h1>From material cost to <em>completed order.</em></h1>
          <p>WoodWork brings materials, Bill of Materials, quotations, production, sales and invoices into one clear operating system for your business.</p>
          <div className="landing-hero-actions">
            <Link className="landing-button" href={appHref}>{appLabel}<span>→</span></Link>
            <a className="landing-secondary-button" href="#workflow">See how it works</a>
          </div>
          <div className="landing-proof">
            <span><strong>One workspace</strong><small>From costing to payment</small></span>
            <span><strong>Live pricing</strong><small>Materials and margins</small></span>
            <span><strong>Team access</strong><small>Roles and permissions</small></span>
          </div>
        </div>

        <div className="landing-hero-visual" aria-label="WoodWork application preview">
          <div className="landing-photo" />
          <div className="landing-floating-card material-float">
            <span className="landing-mini-icon"><WorkspaceIcon name="materials" /></span>
            <span><small>Material cost</small><strong>₦286,500</strong></span>
          </div>
          <div className="landing-floating-card order-float">
            <span className="landing-status-dot" />
            <span><small>Order status</small><strong>In production</strong></span>
          </div>
          <div className="landing-dashboard-card">
            <header><span><i /><i /><i /></span><small>Business overview</small></header>
            <div className="landing-dashboard-metrics">
              <span><small>Revenue</small><strong>₦4.8m</strong></span>
              <span><small>Orders</small><strong>28</strong></span>
              <span><small>Outstanding</small><strong>₦620k</strong></span>
            </div>
            <div className="landing-chart">
              {[44, 68, 53, 82, 64, 91, 76].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}
            </div>
          </div>
        </div>
      </section>

      <section className="landing-trust-strip">
        <span>Materials</span><i /> <span>Costing</span><i /> <span>Quotations</span><i /> <span>Production</span><i /> <span>Inventory</span><i /> <span>Invoices</span>
      </section>

      <section className="landing-section" id="features">
        <div className="landing-section-heading">
          <div><span className="landing-kicker">Everything connected</span><h2>Run the whole job, not another spreadsheet.</h2></div>
          <p>Each part of the workflow shares the same material, product and customer information, so your team works from one source of truth.</p>
        </div>
        <div className="landing-feature-grid">
          {features.map(([icon, title, copy]) => (
            <article key={title}>
              <span className="landing-feature-icon"><WorkspaceIcon name={icon} /></span>
              <h3>{title}</h3>
              <p>{copy}</p>
              <span className="landing-feature-arrow">↗</span>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-product-section" id="workflow">
        <div className="landing-product-copy">
          <span className="landing-kicker">See the workflow</span>
          <div className="landing-slide-icon"><WorkspaceIcon name={slides[slide].icon} /></div>
          <span className="landing-slide-eyebrow">{slides[slide].eyebrow}</span>
          <h2>{slides[slide].title}</h2>
          <p>{slides[slide].copy}</p>
          <div className="landing-slider-controls">
            <button onClick={() => setSlide((slide - 1 + slides.length) % slides.length)} aria-label="Previous slide">←</button>
            <span>{slides.map((item, index) => <button aria-label={`Show ${item.eyebrow}`} className={slide === index ? "active" : ""} key={item.title} onClick={() => setSlide(index)} />)}</span>
            <button onClick={() => setSlide((slide + 1) % slides.length)} aria-label="Next slide">→</button>
          </div>
        </div>
        <ProductVisual type={slides[slide].visual} />
      </section>

      <section className="landing-section landing-process" id="about">
        <div className="landing-section-heading">
          <div><span className="landing-kicker">A simpler process</span><h2>Four steps from materials to money.</h2></div>
          <p>WoodWork follows the way a production business actually operates, keeping every stage visible and connected.</p>
        </div>
        <div className="landing-step-grid">
          {steps.map(([number, title, copy]) => (
            <article key={number}><span>{number}</span><h3>{title}</h3><p>{copy}</p></article>
          ))}
        </div>
      </section>

      <section className="landing-cta">
        <div>
          <span className="landing-kicker">Start with your next job</span>
          <h2>Know your costs. Protect your margin. Deliver with confidence.</h2>
        </div>
        <div>
          <Link className="landing-button light" href={appHref}>{appLabel}<span>→</span></Link>
          {!token && <Link className="landing-cta-signin" href="/login">Already have an account? Sign in</Link>}
        </div>
      </section>

      <footer className="landing-footer">
        <div className="brand"><span className="brand-mark">W</span><span><strong>WoodWork</strong></span></div>
        <p>Materials, production and sales in one workspace.</p>
        <span>© {new Date().getFullYear()} WoodWork</span>
      </footer>
    </main>
  );
}

function ProductVisual({ type }) {
  return (
    <div className={`landing-product-visual visual-${type}`}>
      <div className="landing-mock-window">
        <header><span><i /><i /><i /></span><strong>WoodWork</strong><small>•••</small></header>
        {type === "catalog" && (
          <div className="mock-catalog">
            <div className="mock-title"><span><small>Materials</small><strong>Approved material library</strong></span><b>+ Add material</b></div>
            <div className="mock-filter"><i /><i /><i /></div>
            <div className="mock-materials">
              {["Walnut board", "Velvet fabric", "High-density foam"].map((name, index) => <article key={name}><span className={`mock-swatch swatch-${index}`} /><div><strong>{name}</strong><small>{["sqm · 48 × 96 inches", "yard · cream", "sqm · 4 inches"][index]}</small></div><b>{["₦18,500", "₦3,200", "₦12,000"][index]}</b></article>)}
            </div>
          </div>
        )}
        {type === "bom" && (
          <div className="mock-bom">
            <div className="mock-title"><span><small>Bill of Materials</small><strong>Walnut side table</strong></span><b>Draft</b></div>
            <div className="mock-bom-layout">
              <div>{["Walnut board", "Wood glue", "Clear finish"].map((name, index) => <article key={name}><i>{index + 1}</i><span><strong>{name}</strong><small>{["2.40 sqm", "1 piece", "2 liters"][index]}</small></span><b>{["₦44,400", "₦3,500", "₦8,000"][index]}</b></article>)}</div>
              <aside><small>Materials</small><strong>₦55,900</strong><small>Overhead</small><strong>₦12,000</strong><small>Selling price</small><b>₦95,000</b></aside>
            </div>
          </div>
        )}
        {type === "sales" && (
          <div className="mock-sales">
            <div className="mock-title"><span><small>Sales overview</small><strong>June performance</strong></span><b>+12.8%</b></div>
            <div className="mock-sales-metrics"><span><small>Revenue</small><strong>₦4.8m</strong></span><span><small>Collected</small><strong>₦4.1m</strong></span><span><small>Orders</small><strong>28</strong></span></div>
            <div className="mock-line-chart"><svg viewBox="0 0 600 180" preserveAspectRatio="none"><path d="M0 150 C70 145, 85 105, 150 115 S240 55, 300 82 S400 24, 455 48 S540 14, 600 20" /><path className="fill" d="M0 150 C70 145, 85 105, 150 115 S240 55, 300 82 S400 24, 455 48 S540 14, 600 20 L600 180 L0 180 Z" /></svg></div>
          </div>
        )}
      </div>
    </div>
  );
}
