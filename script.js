/* Finance Toolkit — JS (paste into CodePen JS with Babel/JSX)
   This version keeps all non-loan tabs as-is, restores the Instagram icon,
   and updates "Loans & Payoff Lab" per your spec.
*/
const { useState, useMemo, useEffect, useRef } = React;

/* =========================
   Number & currency helpers
========================= */
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const cleanNumberText = s => String(s !== null && s !== void 0 ? s : '').replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');
const parseCurrency = s => {
  const c = cleanNumberText(s);
  if (!c) return NaN;
  const n = Number(c);
  return Number.isFinite(n) ? n : NaN;
};
const fmtCurrency0 = n => Number.isFinite(n) ?
n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }) :
'—';
const fmtCurrency2 = n => Number.isFinite(n) ?
n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }) :
'—';
const fmtPercent1 = n => Number.isFinite(n) ?
`${(n * 100).toLocaleString(undefined, { maximumFractionDigits: 1 })}%` :
'—';
const fmt1 = n => Number.isFinite(n) ?
n.toLocaleString(undefined, { maximumFractionDigits: 1 }) :
'—';
const yearsToMonths = y => Math.max(1, Math.round(Number(y || 0) * 12));

/* Animated number for nice transitions */
const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
function SmoothNumber({ value, format = 'int', className = '' }) {
  const rafRef = useRef(null);
  const startRef = useRef(null);
  const [display, setDisplay] = useState(Number.isFinite(value) ? value : NaN);
  useEffect(() => {
    if (!Number.isFinite(value)) {setDisplay(NaN);return;}
    const from = Number.isFinite(display) ? display : value;
    const dur = 650;
    cancelAnimationFrame(rafRef.current);
    startRef.current = null;
    const tick = ts => {
      if (!startRef.current) startRef.current = ts;
      const t = clamp((ts - startRef.current) / dur, 0, 1);
      setDisplay(from + (value - from) * easeOutCubic(t));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value]); // eslint-disable-line

  const out = (() => {
    if (!Number.isFinite(display)) return '—';
    if (format === 'int') return Math.round(display).toLocaleString();
    if (format === 'one') return Number(display).toLocaleString(undefined, { maximumFractionDigits: 1 });
    if (format === 'usd0') return fmtCurrency0(display);
    if (format === 'usd2') return fmtCurrency2(display);
    return Number(display).toLocaleString(undefined, { maximumFractionDigits: 2 });
  })();

  return /*#__PURE__*/React.createElement("span", { className: 'mono ' + className }, out);
}

/* =========================
   Tax (approx) — SINGLE filer
========================= */
function estFedTaxSingleEffective(annualIncome) {
  const stdDeduction = 14600; // 2024-ish approx
  let ti = Math.max(0, (annualIncome || 0) - stdDeduction);
  const brackets = [
  { upTo: 11600, rate: 0.10 },
  { upTo: 47150, rate: 0.12 },
  { upTo: 100525, rate: 0.22 },
  { upTo: 191950, rate: 0.24 },
  { upTo: 243725, rate: 0.32 },
  { upTo: 609350, rate: 0.35 },
  { upTo: Infinity, rate: 0.37 }];

  let tax = 0,prev = 0;
  for (const b of brackets) {
    if (ti <= 0) break;
    const chunk = Math.min(ti, b.upTo - prev);
    tax += chunk * b.rate;
    ti -= chunk;
    prev = b.upTo;
  }
  const eff = annualIncome > 0 ? tax / annualIncome : NaN;
  return { tax, effective: eff };
}

/* =========================
   Tooltip system (fitness style)
========================= */
function SmartTooltip({ anchorRef, tip, href, open, onRequestClose, preferred = 'right' }) {
  const tooltipRef = React.useRef(null);
  const [mounted, setMounted] = React.useState(false);
  const [visible, setVisible] = React.useState(false);
  const [pos, setPos] = React.useState({ top: 0, left: 0, placement: 'right', arrowLeft: 12, arrowTop: 12 });

  const computePosition = React.useCallback(() => {
    const a = anchorRef === null || anchorRef === void 0 ? void 0 : anchorRef.current,t = tooltipRef === null || tooltipRef === void 0 ? void 0 : tooltipRef.current;
    if (!a || !t) return;
    const rect = a.getBoundingClientRect();
    const vw = window.innerWidth || document.documentElement.clientWidth;
    const vh = window.innerHeight || document.documentElement.clientHeight;

    let w = t.offsetWidth || 320,h = t.offsetHeight || 120;
    const margin = 8,gap = 10;

    const fitsRight = rect.right + gap + w <= vw - margin;
    const fitsLeft = rect.left - gap - w >= margin;
    const fitsBottom = rect.bottom + gap + h <= vh - margin;
    const fitsTop = rect.top - gap - h >= margin;

    const order = (() => {
      const arr = ['right', 'left', 'bottom', 'top'];
      const idx = arr.indexOf(preferred);
      return idx === -1 ? arr : [arr[idx], ...arr.filter((_, i) => i !== idx)];
    })();

    let placement = 'right',top = 0,left = 0,arrowLeft = 12,arrowTop = 12;

    for (const p of order) {
      if (p === 'right' && fitsRight) {placement = 'right';left = rect.right + gap;top = rect.top + (rect.height - h) / 2;top = Math.max(margin, Math.min(top, vh - h - margin));arrowTop = rect.top + rect.height / 2 - top;arrowTop = Math.max(10, Math.min(arrowTop, h - 10));arrowLeft = -6;break;}
      if (p === 'left' && fitsLeft) {placement = 'left';left = rect.left - gap - w;top = rect.top + (rect.height - h) / 2;top = Math.max(margin, Math.min(top, vh - h - margin));arrowTop = rect.top + rect.height / 2 - top;arrowTop = Math.max(10, Math.min(arrowTop, h - 10));arrowLeft = w - 6;break;}
      if (p === 'bottom' && fitsBottom) {placement = 'bottom';top = rect.bottom + gap;left = rect.left + (rect.width - w) / 2;left = Math.max(margin, Math.min(left, vw - w - margin));arrowLeft = rect.left + rect.width / 2 - left;arrowLeft = Math.max(10, Math.min(arrowLeft, w - 10));arrowTop = -6;break;}
      if (p === 'top' && fitsTop) {placement = 'top';top = rect.top - gap - h;left = rect.left + (rect.width - w) / 2;left = Math.max(margin, Math.min(left, vw - w - margin));arrowLeft = rect.left + rect.width / 2 - left;arrowLeft = Math.max(10, Math.min(arrowLeft, w - 10));arrowTop = h - 6;break;}
    }

    if (!['right', 'left', 'bottom', 'top'].includes(placement)) {
      placement = preferred || 'right';
      if (placement === 'left') {left = rect.left - gap - w;top = rect.top + (rect.height - h) / 2;} else
      if (placement === 'bottom') {top = rect.bottom + gap;left = rect.left + (rect.width - w) / 2;} else
      if (placement === 'top') {top = rect.top - gap - h;left = rect.left + (rect.width - w) / 2;} else
      {left = rect.right + gap;top = rect.top + (rect.height - h) / 2;}
      left = Math.max(margin, Math.min(left, vw - w - margin));
      top = Math.max(margin, Math.min(top, vh - h - margin));
      arrowTop = Math.max(10, Math.min(rect.top + rect.height / 2 - top, h - 10));
      arrowLeft = Math.max(10, Math.min(rect.left + rect.width / 2 - left, w - 10));
      if (placement === 'right') arrowLeft = -6;
      if (placement === 'left') arrowLeft = w - 6;
      if (placement === 'bottom') arrowTop = -6;
      if (placement === 'top') arrowTop = h - 6;
    }

    setPos({ top, left, placement, arrowLeft, arrowTop });
  }, [anchorRef, preferred]);

  React.useEffect(() => {
    if (open) {
      setMounted(true);
      requestAnimationFrame(() => {setVisible(true);computePosition();requestAnimationFrame(computePosition);});
      const onScroll = () => computePosition();
      const onResize = () => computePosition();
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onResize);
      const t = tooltipRef.current,a = anchorRef === null || anchorRef === void 0 ? void 0 : anchorRef.current;
      const ro = new ResizeObserver(() => computePosition());
      if (t) ro.observe(t);
      if (a) ro.observe(a);
      return () => {window.removeEventListener('scroll', onScroll);window.removeEventListener('resize', onResize);ro.disconnect();};
    } else {
      setVisible(false);
      const id = setTimeout(() => setMounted(false), 160);
      return () => clearTimeout(id);
    }
  }, [open, computePosition, anchorRef]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = e => {
      const t = tooltipRef.current,a = anchorRef === null || anchorRef === void 0 ? void 0 : anchorRef.current;
      if (!t || !a) return;
      if (!t.contains(e.target) && !a.contains(e.target)) onRequestClose === null || onRequestClose === void 0 ? void 0 : onRequestClose();
    };
    const onKey = e => {if (e.key === 'Escape') onRequestClose === null || onRequestClose === void 0 ? void 0 : onRequestClose();};
    document.addEventListener('mousedown', onDocClick, true);
    document.addEventListener('keydown', onKey);
    return () => {document.removeEventListener('mousedown', onDocClick, true);document.removeEventListener('keydown', onKey);};
  }, [open, onRequestClose, anchorRef]);

  if (!mounted) return null;

  const style = {
    top: pos.top, left: pos.left,
    maxWidth: 'min(92vw, 360px)',
    opacity: visible ? 1 : 0,
    transform:
    pos.placement === 'right' ? visible ? 'translateX(0) scale(1)' : 'translateX(6px) scale(0.98)' :
    pos.placement === 'left' ? visible ? 'translateX(0) scale(1)' : 'translateX(-6px) scale(0.98)' :
    visible ? 'translateY(0) scale(1)' : 'translateY(6px) scale(0.98)',
    transition: 'opacity 140ms ease, transform 160ms cubic-bezier(.2,.7,.2,1)',
    transformOrigin:
    pos.placement === 'right' ? 'left center' :
    pos.placement === 'left' ? 'right center' :
    pos.placement === 'bottom' ? 'top center' : 'bottom center' };


  const arrowCommon = 'absolute h-3 w-3 rotate-45 bg-white border border-slate-200 shadow-sm';
  const arrowStyle =
  pos.placement === 'right' ? { top: pos.arrowTop, left: -6 } :
  pos.placement === 'left' ? { top: pos.arrowTop, left: 'calc(100% - 6px)' } :
  pos.placement === 'bottom' ? { left: pos.arrowLeft, top: -6 } :
  { left: pos.arrowLeft, top: 'calc(100% - 6px)' };

  return ReactDOM.createPortal( /*#__PURE__*/
  React.createElement("div", { ref: tooltipRef, className: "fixed z-[61] pointer-events-auto", style: style, role: "tooltip" }, /*#__PURE__*/
  React.createElement("div", { className: arrowCommon, style: arrowStyle, "aria-hidden": "true" }), /*#__PURE__*/
  React.createElement("div", {
    className: "rounded-xl border border-slate-200 shadow-lg bg-white/95 backdrop-blur p-3 text-xs text-slate-700",
    onMouseEnter: e => e.stopPropagation(),
    onMouseLeave: () => onRequestClose === null || onRequestClose === void 0 ? void 0 : onRequestClose(),
    style: { lineHeight: 1.35 } }, /*#__PURE__*/

  React.createElement("div", { style: { whiteSpace: 'pre-line' } }, tip || ''),
  href && /*#__PURE__*/
  React.createElement("div", { className: "mt-2" }, /*#__PURE__*/
  React.createElement("a", { className: "underline", href: href, target: "_blank", rel: "noreferrer" }, "Source")))),




  document.body);

}
const Info = ({ abbr, tip, href }) => {
  const [open, setOpen] = React.useState(false);
  const btnRef = React.useRef(null);
  const timers = React.useRef({ open: null, close: null });
  const clearTimers = () => {if (timers.current.open) clearTimeout(timers.current.open);if (timers.current.close) clearTimeout(timers.current.close);timers.current.open = timers.current.close = null;};
  const openWithDelay = () => {clearTimers();timers.current.open = setTimeout(() => setOpen(true), 70);};
  const closeWithDelay = () => {clearTimers();timers.current.close = setTimeout(() => setOpen(false), 200);};
  React.useEffect(() => () => clearTimers(), []);
  return /*#__PURE__*/(
    React.createElement("span", { className: "inline-flex items-center gap-1 text-xs text-slate-500 ml-1" },
    abbr && abbr !== 'i' && /*#__PURE__*/React.createElement("span", { className: "font-semibold" }, "(", abbr, ")"), /*#__PURE__*/
    React.createElement("button", {
      ref: btnRef,
      className: "icon-btn hover:bg-slate-100 transition-colors duration-150",
      type: "button",
      "aria-label": tip || abbr || 'Info',
      "aria-expanded": open ? 'true' : 'false',
      onMouseEnter: openWithDelay,
      onMouseLeave: closeWithDelay,
      onFocus: openWithDelay,
      onBlur: () => setOpen(false),
      onClick: () => setOpen(v => !v) }, "i"), /*#__PURE__*/

    React.createElement(SmartTooltip, {
      anchorRef: btnRef,
      tip: tip,
      href: href,
      open: open,
      onRequestClose: () => setOpen(false),
      preferred: "right" })));



};

/* =========================
   Small UI atoms
========================= */
const Section = ({ title, right, children }) => /*#__PURE__*/
React.createElement("section", { className: "card p-4 mb-4" }, /*#__PURE__*/
React.createElement("header", { className: "flex items-center justify-between mb-3" }, /*#__PURE__*/
React.createElement("h2", { className: "text-lg font-semibold" }, title),
right),

children);



/* PATCH #4 — Social icons restored exactly to prior version */
const InstagramSVG = () => /*#__PURE__*/
React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 24 24", className: "w-4 h-4", fill: "currentColor" }, /*#__PURE__*/React.createElement("path", { d: "M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7zm5 3.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11zm0 2a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM18 6.2a1 1 0 1 1 0 2 1 1 0 0 1 0-2z" }));

const TikTokSVG = () => /*#__PURE__*/
React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 48 48", className: "w-4 h-4", fill: "currentColor" }, /*#__PURE__*/React.createElement("path", { d: "M30 6c1.6 3.6 4.6 6.3 8.3 7.2v6.1c-3.2-.1-6.2-1.1-8.7-2.8v12.3c0 7.1-5.7 12.8-12.8 12.8S4 35.9 4 28.8s5.7-12.8 12.8-12.8c1.2 0 2.4.2 3.5.5v6.4c-.9-.4-1.9-.6-3-.6-3.4 0-6.3 2.8-6.3 6.3s2.8 6.3 6.3 6.3 6.3-2.8 6.3-6.3V6h6.4z" }));

const Social = () => /*#__PURE__*/
React.createElement("div", { className: "flex items-center gap-4 text-sm" }, /*#__PURE__*/
React.createElement("a", { className: "inline-flex items-center gap-1 underline", href: "https://www.instagram.com/luisitin2001", target: "_blank", rel: "noreferrer", title: "@luisitin2001 on Instagram" }, /*#__PURE__*/React.createElement(InstagramSVG, null), "Instagram"), /*#__PURE__*/
React.createElement("span", { className: "text-slate-400" }, "\u2022"), /*#__PURE__*/
React.createElement("a", { className: "inline-flex items-center gap-1 underline", href: "https://www.tiktok.com/@luisitin2001", target: "_blank", rel: "noreferrer" }, /*#__PURE__*/React.createElement(TikTokSVG, null), "TikTok"));


/* Cadence toggle — parent supplies onChange that handles conversion */
function CadenceToggle({ cadence, onChange }) {
  return /*#__PURE__*/(
    React.createElement("div", { className: "flex items-center gap-2 text-xs" }, /*#__PURE__*/
    React.createElement("span", { className: "text-slate-500 hidden sm:inline" }, "View"), /*#__PURE__*/
    React.createElement("div", { className: "inline-flex rounded-full border bg-white overflow-hidden" },
    ['Monthly', 'Annual'].map((c) => /*#__PURE__*/
    React.createElement("button", {
      key: c,
      onClick: () => onChange(c),
      className: (cadence === c ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50') + ' px-2 py-1' },

    c)))));





}

/* Currency input with $ + commas */
function CurrencyInput({ value, onChange, placeholder }) {
  const [text, setText] = useState(value != null && Number.isFinite(value) ? Math.round(value).toString() : '');
  useEffect(() => {
    if (Number.isFinite(value)) {
      setText(Math.round(value).toString());
    } else if (value === '' || value == null) {
      setText('');
    }
  }, [value]);

  const display = text ? fmtCurrency0(parseCurrency(text)) : '';

  const handleChange = e => {
    const cleaned = cleanNumberText(e.target.value);
    setText(cleaned);
    const n = parseCurrency(cleaned);
    onChange === null || onChange === void 0 ? void 0 : onChange(Number.isFinite(n) ? n : NaN);
  };

  return /*#__PURE__*/(
    React.createElement("input", {
      type: "text",
      inputMode: "numeric",
      className: "field",
      placeholder: placeholder,
      value: display,
      onChange: handleChange }));


}

/* =========================
   Finance helpers
========================= */
const monthlyRate = apr => apr / 100 / 12;
function pmtForMonths(balance, apr, nMonths) {
  const i = monthlyRate(apr);
  const N = Math.max(1, Math.round(nMonths));
  if (!Number.isFinite(balance) || balance <= 0 || !Number.isFinite(N) || N <= 0) return NaN;
  if (i === 0) return balance / N;
  return balance * i / (1 - Math.pow(1 + i, -N));
}
function futureValue({ principal = 0, monthly = 0, apr = 0, years = 0 }) {
  const i = monthlyRate(apr);
  const n = yearsToMonths(years);
  if (n <= 0) return principal;
  if (i === 0) return principal + monthly * n;
  return principal * Math.pow(1 + i, n) + monthly * (Math.pow(1 + i, n) - 1) / i;
}
function requiredMonthly({ goal = 0, principal = 0, apr = 0, years = 0 }) {
  const i = monthlyRate(apr);
  const n = yearsToMonths(years);
  if (n <= 0) return NaN;
  const growth = Math.pow(1 + i, n);
  if (i === 0) return (goal - principal) / n;
  return (goal - principal * growth) * i / (growth - 1);
}
function loanPayment({ principal = 0, apr = 0, years = 0 }) {
  const n = yearsToMonths(years);
  const pmt = pmtForMonths(principal, apr, n);
  const totalPaid = pmt * n;
  return { pmt, totalPaid, totalInterest: totalPaid - principal };
}

/* Amortization engine (Baseline and Scenarios) — uses integer-month math */
function amortizeSchedule({
  balance,
  apr,
  nMonths, // preferred exact months
  yearsRemaining, // fallback if nMonths not given
  currentPayment, // optional: if absent, computed from balance/apr/nMonths
  extraMonthly = 0,
  startMonth = 1,
  lumpSums = [],
  limitMonths = 1200 // hard safety
}) {
  const i = monthlyRate(apr);
  const N = Number.isFinite(nMonths) ? Math.max(1, Math.round(nMonths)) :
  yearsToMonths(yearsRemaining);
  let pmt = Number.isFinite(currentPayment) ? currentPayment : pmtForMonths(balance, apr, N);
  if (!Number.isFinite(pmt) || pmt <= 0) return { rows: [], payoffMonth: NaN, totalInterest: NaN, negAm: true };

  const rows = [];
  let bal = balance;
  let cumInterest = 0,cumPrincipal = 0;
  let m = 0;
  let negAm = false;
  const cap = Math.min(limitMonths, N * 2 + 240); // generous cap

  while (bal > 0.01 && m < cap) {
    m += 1;
    const interest = bal * i;
    let principalPay = pmt - interest;
    if (m >= startMonth) principalPay += Math.max(0, extraMonthly);

    // lump sums this month
    const extraLump = lumpSums.
    filter(x => x && Number.isFinite(x.month) && Number.isFinite(x.amount) && x.amount > 0 && x.month === m).
    reduce((a, x) => a + x.amount, 0);

    let totalPrincipalThisMonth = principalPay + extraLump;

    if (principalPay < 0) {negAm = true;principalPay = 0;}
    if (totalPrincipalThisMonth > bal) totalPrincipalThisMonth = bal;

    bal = Math.max(0, bal - totalPrincipalThisMonth);
    cumInterest += Math.max(0, interest);
    cumPrincipal += totalPrincipalThisMonth;

    rows.push({
      month: m,
      interest,
      principal: totalPrincipalThisMonth,
      payment: pmt,
      extraMonthly: m >= startMonth ? Math.max(0, extraMonthly) : 0,
      extraLump,
      balance: bal,
      cumInterest,
      cumPrincipal });

  }

  return {
    rows,
    payoffMonth: rows.length,
    totalInterest: cumInterest,
    negAm };

}

/* Refinance scenario (refiYears -> rounded months) */
function refinanceScenario({
  balance,
  apr,
  yearsRemaining,
  currentPayment, // optional (Advanced)
  refiYears,
  newAPR,
  newTermYears,
  costs = 0 })
{
  const baseN = yearsToMonths(yearsRemaining);
  const basePmt = Number.isFinite(currentPayment) ? currentPayment : pmtForMonths(balance, apr, baseN);

  const refiM = yearsToMonths(refiYears);
  // run baseline up to refi month exactly
  const preRefi = amortizeSchedule({
    balance, apr, nMonths: baseN, currentPayment: basePmt,
    extraMonthly: 0, startMonth: 99999, lumpSums: [],
    limitMonths: refiM });


  const rows = preRefi.rows;
  const lastRow = rows[Math.min(rows.length, refiM) - 1] || rows[rows.length - 1];
  if (!lastRow) return { rows: [], payoffMonth: NaN, totalInterest: NaN, negAm: true };

  const balAtRefi = lastRow.balance + Math.max(0, costs);
  const newN = yearsToMonths(newTermYears);
  const pmtNew = pmtForMonths(balAtRefi, newAPR, newN);

  const postRefi = amortizeSchedule({
    balance: balAtRefi, apr: newAPR, nMonths: newN, currentPayment: pmtNew,
    extraMonthly: 0, startMonth: 99999, lumpSums: [] });


  // stitch sequences, adjusting month indices & cumulative interest/principal
  const stitched = [];
  for (const r of rows) stitched.push({ ...r });
  let cumInterest = stitched.length ? stitched[stitched.length - 1].cumInterest : 0;
  let cumPrincipal = stitched.length ? stitched[stitched.length - 1].cumPrincipal : 0;
  const offset = rows.length;

  for (const r of postRefi.rows) {
    cumInterest += r.interest;
    cumPrincipal += r.principal;
    stitched.push({
      month: offset + r.month,
      interest: r.interest,
      principal: r.principal,
      payment: r.payment,
      extraMonthly: 0,
      extraLump: 0,
      balance: r.balance,
      cumInterest,
      cumPrincipal });

  }

  return {
    rows: stitched,
    payoffMonth: stitched.length,
    totalInterest: stitched.length ? stitched[stitched.length - 1].cumInterest : NaN,
    negAm: preRefi.negAm || postRefi.negAm,
    balAtRefi,
    newPayment: pmtNew };

}

/* SVG Line Chart (Baseline vs Scenario) with metric selection */
/* PATCH — InterestChart with non-overlapping axis labels */
function InterestChart({ baseRows, altRows, metric = 'cumInterest' }) {
  // Separate paddings so we can give the x-axis more room
  const width = 860,height = 340;
  const pad = { top: 24, right: 24, bottom: 56, left: 68 };
  const W = width - pad.left - pad.right;
  const H = height - pad.top - pad.bottom;

  // (We only expose 2 metrics now: total interest vs total principal)
  const pickY = r => metric === 'cumPrincipal' ? r.cumPrincipal : r.cumInterest;

  const maxM = Math.max((baseRows === null || baseRows === void 0 ? void 0 : baseRows.length) || 0, (altRows === null || altRows === void 0 ? void 0 : altRows.length) || 0, 1);
  const maxY = Math.max(
  baseRows !== null && baseRows !== void 0 && baseRows.length ? pickY(baseRows[baseRows.length - 1]) : 0,
  altRows !== null && altRows !== void 0 && altRows.length ? pickY(altRows[altRows.length - 1]) : 0,
  1);


  const mapX = m => pad.left + m / maxM * W;
  const mapY = y => pad.top + H - y / maxY * H;

  const pathFor = rows => {
    if (!(rows !== null && rows !== void 0 && rows.length)) return '';
    let d = `M ${mapX(0)} ${mapY(0)}`;
    rows.forEach(r => {d += ` L ${mapX(r.month)} ${mapY(pickY(r))}`;});
    return d;
  };

  const basePath = pathFor(baseRows);
  const altPath = pathFor(altRows);

  // ===== Ticks =====
  const numYTicks = 5; // 0..100%
  const numXTicks = 5;

  const yTicks = Array.from({ length: numYTicks }, (_, i) => {
    const frac = i / (numYTicks - 1);
    const yv = frac * maxY;
    return { yv, y: mapY(yv) };
  });

  const xTicks = Array.from({ length: numXTicks }, (_, i) => {
    const frac = i / (numXTicks - 1);
    const mv = Math.round(frac * maxM);
    return { mv, x: mapX(mv) };
  });

  // Compact currency for y labels
  const fmtCurrencyCompact = (n) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1 }).
  format(n);

  const yLabel =
  metric === 'cumPrincipal' ? 'Total principal payments (USD)' : 'Total interest payments (USD)';

  return /*#__PURE__*/(
    React.createElement("svg", { viewBox: `0 0 ${width} ${height}`, className: "w-full h-[340px]" }, /*#__PURE__*/

    React.createElement("rect", { x: pad.left, y: pad.top, width: W, height: H, fill: "white", stroke: "#e5e7eb" }),


    yTicks.map((t, i) => /*#__PURE__*/
    React.createElement("g", { key: `y-${i}` }, /*#__PURE__*/
    React.createElement("line", { x1: pad.left, y1: t.y, x2: pad.left + W, y2: t.y, stroke: "#e5e7eb", strokeDasharray: "3 4" }), /*#__PURE__*/
    React.createElement("text", {
      x: pad.left - 8,
      y: t.y,
      fontSize: "10",
      fill: "#64748b",
      textAnchor: "end",
      dominantBaseline: "middle" },

    fmtCurrencyCompact(t.yv)))),





    xTicks.map((t, i) => /*#__PURE__*/
    React.createElement("g", { key: `x-${i}` }, /*#__PURE__*/
    React.createElement("line", { x1: t.x, y1: pad.top, x2: t.x, y2: pad.top + H, stroke: "#eef2f7", strokeDasharray: "3 4" }), /*#__PURE__*/
    React.createElement("text", {
      x: t.x,
      y: pad.top + H + 16 // tick numbers
      , fontSize: "10",
      fill: "#64748b",
      textAnchor: "middle" },

    t.mv))),





    (baseRows === null || baseRows === void 0 ? void 0 : baseRows.length) > 0 && /*#__PURE__*/
    React.createElement("path", { d: basePath, fill: "none", stroke: "#94a3b8", strokeWidth: "3" }),

    (altRows === null || altRows === void 0 ? void 0 : altRows.length) > 0 && /*#__PURE__*/
    React.createElement("path", { d: altPath, fill: "none", stroke: "#10b981", strokeWidth: "3" }), /*#__PURE__*/



    React.createElement("g", { transform: `translate(${pad.left + 8}, ${pad.top + 8})` }, /*#__PURE__*/
    React.createElement("rect", { x: "0", y: "0", width: "190", height: "36", rx: "8", fill: "white", stroke: "#e5e7eb" }), /*#__PURE__*/
    React.createElement("g", { transform: "translate(10,10)" }, /*#__PURE__*/
    React.createElement("rect", { width: "18", height: "4", rx: "2", fill: "#94a3b8" }), /*#__PURE__*/
    React.createElement("text", { x: "26", y: "4", dominantBaseline: "middle", fontSize: "12", fill: "#334155" }, "Baseline")), /*#__PURE__*/

    React.createElement("g", { transform: "translate(10,22)" }, /*#__PURE__*/
    React.createElement("rect", { width: "18", height: "4", rx: "2", fill: "#10b981" }), /*#__PURE__*/
    React.createElement("text", { x: "26", y: "4", dominantBaseline: "middle", fontSize: "12", fill: "#334155" }, "Scenario"))), /*#__PURE__*/




    React.createElement("text", {
      x: pad.left + W / 2,
      y: height - 8 // below tick numbers
      , fontSize: "11",
      fill: "#64748b",
      textAnchor: "middle" }, "Months"), /*#__PURE__*/



    React.createElement("text", {
      x: 16,
      y: pad.top + H / 2,
      fontSize: "11",
      fill: "#64748b",
      textAnchor: "middle",
      transform: `rotate(-90, 16, ${pad.top + H / 2})` },

    yLabel)));



}




/* =========================
   Info Panel (same as before)
========================= */
const FIN_INFO = [
{
  id: 'compounding',
  label: 'Compound Interest & Starting Early',
  body: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/
  React.createElement("p", { className: "mb-2" }, "Compounding grows money nonlinearly. Small amounts invested early can beat larger amounts invested later."), /*#__PURE__*/
  React.createElement("ul", { className: "list-disc pl-5 space-y-1" }, /*#__PURE__*/
  React.createElement("li", null, "Rule of 72: years to double \u2248 72 / annual return."), /*#__PURE__*/
  React.createElement("li", null, "Monthly contributions and time are the power combo."))),


  sources: [{ label: 'Investor.gov — Compound Interest', href: 'https://www.investor.gov/financial-tools-calculators/calculators/compound-interest-calculator' }] },

{
  id: 'fees',
  label: 'Expense Ratios & Fees',
  body: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/
  React.createElement("p", { className: "mb-2" }, "Fees compound too and can seriously reduce ending wealth over decades."), /*#__PURE__*/
  React.createElement("ul", { className: "list-disc pl-5 space-y-1" }, /*#__PURE__*/
  React.createElement("li", null, "Favor low-cost, diversified funds for long horizons."))),


  sources: [
  { label: 'Bogleheads — Expense ratio', href: 'https://www.bogleheads.org/wiki/Expense_ratio' },
  { label: 'Bogleheads — Mutual fund fees', href: 'https://www.bogleheads.org/wiki/Mutual_funds_and_fees' }] },


{
  id: 'mortgage',
  label: 'Loans & Mortgages',
  body: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/
  React.createElement("p", { className: "mb-2" }, "Amortized loans have fixed payments; most interest is paid early."), /*#__PURE__*/
  React.createElement("ul", { className: "list-disc pl-5 space-y-1" }, /*#__PURE__*/
  React.createElement("li", null, "Shorter terms \u2192 higher payment, far less total interest."), /*#__PURE__*/
  React.createElement("li", null, "Extra principal payments can save years and thousands."))),


  sources: [
  { label: 'CFPB — How lenders compute payments', href: 'https://www.consumerfinance.gov/ask-cfpb/how-do-mortgage-lenders-calculate-monthly-payments-en-1965/' },
  { label: 'CFPB — Explore mortgage rates', href: 'https://www.consumerfinance.gov/owning-a-home/explore-rates/' }] },


{
  id: 'emergency',
  label: 'Emergency Funds',
  body: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/
  React.createElement("p", { className: "mb-2" }, "Cash buffers help you avoid high-interest debt when life happens."), /*#__PURE__*/
  React.createElement("ul", { className: "list-disc pl-5 space-y-1" }, /*#__PURE__*/
  React.createElement("li", null, "Common guidance: 3\u20136 months of expenses (more if income varies)."))),


  sources: [
  { label: 'CFPB — Guide to emergency funds', href: 'https://www.consumerfinance.gov/an-essential-guide-to-building-an-emergency-fund/' },
  { label: 'Investor.gov — Savings Goal Calculator', href: 'https://www.investor.gov/financial-tools-calculators/calculators/savings-goal-calculator' }] },


{
  id: 'tvm',
  label: 'Time Value of Money',
  body: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/
  React.createElement("p", { className: "mb-2" }, "Money today is worth more than money tomorrow due to opportunity cost and compounding. Discount rates convert future values to present terms."), /*#__PURE__*/
  React.createElement("ul", { className: "list-disc pl-5 space-y-1" }, /*#__PURE__*/
  React.createElement("li", null, "Use PV and FV with a discount/return rate."))),


  sources: [
  { label: 'Investor.gov — Compound Interest (concept)', href: 'https://www.investor.gov/introduction-investing/investing-basics/glossary/compound-interest' }] },


{
  id: 'assetalloc',
  label: 'Asset Allocation & Risk',
  body: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/
  React.createElement("p", { className: "mb-2" }, "Allocation balances risk/return across stocks, bonds, and cash. Rebalancing keeps risk inline over time."), /*#__PURE__*/
  React.createElement("ul", { className: "list-disc pl-5 space-y-1" }, /*#__PURE__*/
  React.createElement("li", null, "Write an Investment Policy Statement (IPS) and stick to it."))),


  sources: [
  { label: 'Bogleheads — Investment policy statement', href: 'https://www.bogleheads.org/wiki/Investment_policy_statement' }] },


{
  id: 'refi',
  label: 'Refinancing Basics',
  body: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/
  React.createElement("p", { className: "mb-2" }, "Refinancing swaps your loan for a new one, often to get a lower rate or change the term. Consider total costs and break-even time.")),

  sources: [
  { label: 'CFPB — Rate Explorer', href: 'https://www.consumerfinance.gov/owning-a-home/explore-rates/' }] },


{
  id: 'withdrawal',
  label: 'Withdrawal Rates',
  body: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/
  React.createElement("p", { className: "mb-2" }, "The \u201C4% rule\u201D is a rough historical guideline, not a guarantee. Sequence-of-returns risk matters in early retirement.")),

  sources: [
  { label: 'Investor.gov — Other retirement resources', href: 'https://www.investor.gov/other-retirement-resources' }] }];



function InfoPanel() {var _item$sources;
  const [key, setKey] = useState('compounding');
  const item = useMemo(() => FIN_INFO.find(x => x.id === key) || FIN_INFO[0], [key]);
  return /*#__PURE__*/(
    React.createElement(React.Fragment, null, /*#__PURE__*/
    React.createElement("div", { className: "grid sm:grid-cols-3 gap-3" }, /*#__PURE__*/
    React.createElement("div", null, /*#__PURE__*/
    React.createElement("label", { className: "block text-sm font-medium" }, "Topic"), /*#__PURE__*/
    React.createElement("select", { className: "field", value: key, onChange: e => setKey(e.target.value) },
    FIN_INFO.map(x => /*#__PURE__*/React.createElement("option", { key: x.id, value: x.id }, x.label))))), /*#__PURE__*/



    React.createElement("div", { className: "mt-3 p-3 rounded-xl border bg-white/70 fade-slide-in" }, /*#__PURE__*/
    React.createElement("div", { className: "text-sm space-y-2" }, item.body),
    ((_item$sources = item.sources) === null || _item$sources === void 0 ? void 0 : _item$sources.length) > 0 && /*#__PURE__*/
    React.createElement("div", { className: "text-xs text-slate-600 mt-3" }, "Sources:",
    ' ',
    item.sources.map((s, i) => /*#__PURE__*/
    React.createElement(React.Fragment, { key: s.href }, /*#__PURE__*/
    React.createElement("a", { className: "underline", href: s.href, target: "_blank", rel: "noreferrer" }, s.label),
    i < item.sources.length - 1 ? ', ' : ''))))));







}

/* =========================
   Main App
========================= */
function App() {
  const [view, setView] = useState('Profile');
  const [cadence, setCadence] = useState('Monthly'); // 'Monthly' | 'Annual'

  // Fun facts (expanded)
  const FUN = [
  'Rule of 72: at 8% annual growth, money doubles in ~9 years.',
  'A 1% annual fee can reduce a 40-year ending balance by 20–30%+.',
  'Starting 10 years earlier can beat saving 2× as much starting later.',
  'Most mortgage interest is paid in the first third of the term.',
  'Biweekly mortgage payments (26 half-payments) ≈ 1 extra full payment/year.',
  'An emergency fund of 3–6 months can keep you out of high-APR debt.',
  'Automate savings on payday to dodge decision fatigue.',
  'Refinancing has closing costs; compute break-even months before leaping.',
  'Diversification reduces risk without much return penalty.',
  'Inflation silently taxes cash; consider real (after-inflation) returns.',
  'Paying a 18% APR card is a “guaranteed” 18% return (risk-free).',
  'Sequence-of-returns risk matters most right after you retire.',
  'Extra principal early in a mortgage saves the most interest.',
  'A 15-yr mortgage often cuts total interest by 60–70% vs 30-yr.',
  'A Roth’s tax-free growth can be potent if you expect higher future taxes.',
  'Keeping costs low is one of the few “free lunches” in investing.'];

  const [factIdx, setFactIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setFactIdx(i => (i + 1) % FUN.length), 10000);
    return () => clearInterval(id);
  }, []);
  const shuffleFact = () => setFactIdx(i => (i + 1) % FUN.length);

  /* ===== Profile state (Simple/Advanced toggles) — unchanged behavior ===== */
  const [incMode, setIncMode] = useState('Simple');
  const [expMode, setExpMode] = useState('Simple');
  const [savMode, setSavMode] = useState('Simple');

  // Placeholders (UX only)
  const medianAnnualIncome = 74000;
  const medianMonthlyIncome = Math.round(medianAnnualIncome / 12);
  const medianMonthlyExpenses = 4000;
  const medianLiquidSavings = 5300;

  // Income (Simple/Advanced)
  const [incSimple, setIncSimple] = useState(NaN);
  const [incWork, setIncWork] = useState(NaN);
  const [incHustle, setIncHustle] = useState(NaN);
  const [incTenants, setIncTenants] = useState(NaN);
  // Expenses
  const [expSimple, setExpSimple] = useState(NaN);
  const [expHousing, setExpHousing] = useState(NaN);
  const [expAuto, setExpAuto] = useState(NaN);
  const [expFood, setExpFood] = useState(NaN);
  const [expEntertainment, setExpEntertainment] = useState(NaN);
  const [expInsurance, setExpInsurance] = useState(NaN);
  const [expUtilities, setExpUtilities] = useState(NaN);
  const [expOther, setExpOther] = useState(NaN);
  // Savings balances
  const [liquidSavings, setLiquidSavings] = useState(NaN);
  const [balEmergency, setBalEmergency] = useState(NaN);
  const [balPretax, setBalPretax] = useState(NaN);
  const [balRoth, setBalRoth] = useState(NaN);
  const [balTaxable, setBalTaxable] = useState(NaN);

  // Cadence conversions (unchanged)
  const handleCadenceChange = next => {
    if (next === cadence) return;
    const factor = cadence === 'Monthly' && next === 'Annual' ? 12 : 1 / 12;
    const conv = v => Number.isFinite(v) ? v * factor : v;
    setIncSimple(prev => conv(prev));
    setIncWork(prev => conv(prev));
    setIncHustle(prev => conv(prev));
    setIncTenants(prev => conv(prev));
    setExpSimple(prev => conv(prev));
    setExpHousing(prev => conv(prev));
    setExpAuto(prev => conv(prev));
    setExpFood(prev => conv(prev));
    setExpEntertainment(prev => conv(prev));
    setExpInsurance(prev => conv(prev));
    setExpUtilities(prev => conv(prev));
    setExpOther(prev => conv(prev));
    setCadence(next);
  };

  // Convert to MONTHLY for analysis (unchanged)
  const monthlyIncome = useMemo(() => {
    const toMo = v => cadence === 'Monthly' ? v : v / 12;
    if (incMode === 'Simple') return Number.isFinite(incSimple) ? toMo(incSimple) : NaN;
    const parts = [incWork, incHustle, incTenants].map(toMo);
    const sum = parts.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
    return sum > 0 ? sum : NaN;
  }, [incMode, incSimple, incWork, incHustle, incTenants, cadence]);

  const monthlyExpenses = useMemo(() => {
    const toMo = v => cadence === 'Monthly' ? v : v / 12;
    if (expMode === 'Simple') return Number.isFinite(expSimple) ? toMo(expSimple) : NaN;
    const parts = [expHousing, expAuto, expFood, expEntertainment, expInsurance, expUtilities, expOther].map(toMo);
    const sum = parts.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
    return sum > 0 ? sum : NaN;
  }, [expMode, expSimple, expHousing, expAuto, expFood, expEntertainment, expInsurance, expUtilities, expOther, cadence]);

  const totalSavingsBalance = useMemo(() => {
    if (savMode === 'Simple') return Number.isFinite(liquidSavings) ? liquidSavings : NaN;
    const parts = [balEmergency, balPretax, balRoth, balTaxable];
    const sum = parts.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
    return sum > 0 ? sum : NaN;
  }, [savMode, liquidSavings, balEmergency, balPretax, balRoth, balTaxable]);

  const dispoMonthly = useMemo(() => {
    if (!Number.isFinite(monthlyIncome) || !Number.isFinite(monthlyExpenses)) return NaN;
    return Math.max(0, monthlyIncome - monthlyExpenses);
  }, [monthlyIncome, monthlyExpenses]);

  const savingsPercent = useMemo(() => {
    if (!Number.isFinite(monthlyIncome) || monthlyIncome <= 0 || !Number.isFinite(dispoMonthly)) return NaN;
    return dispoMonthly / monthlyIncome;
  }, [dispoMonthly, monthlyIncome]);

  const annualIncomeForTax = useMemo(() => Number.isFinite(monthlyIncome) ? monthlyIncome * 12 : NaN, [monthlyIncome]);
  const taxEst = useMemo(() => Number.isFinite(annualIncomeForTax) ? estFedTaxSingleEffective(annualIncomeForTax) : { tax: NaN, effective: NaN }, [annualIncomeForTax]);

  /* ===== Savings & Growth (unchanged) ===== */
  const [sgPrincipal, setSgPrincipal] = useState(NaN);
  const [sgMonthly, setSgMonthly] = useState(NaN);
  const [sgAPR, setSgAPR] = useState(7);
  const [sgYears, setSgYears] = useState(30);
  const [goalFV, setGoalFV] = useState(NaN);
  const sgFV = useMemo(() => {
    const v = futureValue({
      principal: Number.isFinite(sgPrincipal) ? sgPrincipal : 0,
      monthly: Number.isFinite(sgMonthly) ? sgMonthly : 0,
      apr: Number.isFinite(sgAPR) ? sgAPR : 0,
      years: Number.isFinite(sgYears) ? sgYears : 0 });

    return Number.isFinite(v) ? v : NaN;
  }, [sgPrincipal, sgMonthly, sgAPR, sgYears]);
  const sgReqMonthly = useMemo(() => {
    if (!Number.isFinite(goalFV) || goalFV <= 0) return NaN;
    const m = requiredMonthly({
      goal: goalFV,
      principal: Number.isFinite(sgPrincipal) ? sgPrincipal : 0,
      apr: Number.isFinite(sgAPR) ? sgAPR : 0,
      years: Number.isFinite(sgYears) ? sgYears : 0 });

    return Number.isFinite(m) ? m : NaN;
  }, [goalFV, sgPrincipal, sgAPR, sgYears]);

  // Mortgage mini-card (unchanged)
  const [loanP, setLoanP] = useState(250000);
  const [loanAPR, setLoanAPR] = useState(4);
  const [loanYears, setLoanYears] = useState(30);
  const loan = useMemo(() => loanPayment({
    principal: Number.isFinite(loanP) ? loanP : 0,
    apr: Number.isFinite(loanAPR) ? loanAPR : 0,
    years: Number.isFinite(loanYears) ? loanYears : 0 }),
  [loanP, loanAPR, loanYears]);

  /* ===== Optimize Plan (unchanged logic) ===== */
  const [strategy, setStrategy] = useState('FIRE');
  const [optDebtAPR, setOptDebtAPR] = useState(NaN);
  const [optDebtBal, setOptDebtBal] = useState(NaN);
  const rec = useMemo(() => {
    const bullets = [];
    const targets = [];
    let badge = 'PLAN';
    const mi = monthlyIncome,me = monthlyExpenses;

    if (!Number.isFinite(mi) || !Number.isFinite(me)) {
      bullets.push('Provide income and expenses to generate a plan.');
      return { badge, bullets, targets };
    }

    if (strategy === 'FIRE') {
      badge = 'FIRE';
      targets.push('Savings rate ≥ 50% of income');
      if (Number.isFinite(savingsPercent)) bullets.push(`Current savings rate ≈ ${fmt1(savingsPercent * 100)}%`);
      bullets.push('Reduce recurring expenses (housing/transport/food) first.');
      bullets.push('Max out tax-advantaged accounts (401k/IRA/HSA) if eligible.');
      bullets.push('Favor low-fee, broad index funds for long horizon.');
    }

    if (strategy === 'Maximize Retirement') {
      badge = 'INVEST';
      targets.push('Automate 15–20% of gross income toward retirement');
      if (Number.isFinite(savingsPercent)) bullets.push(`Current savings rate ≈ ${fmt1(savingsPercent * 100)}%`);
      bullets.push('Consider target-date or ~80/20 stock/bond allocation.');
      bullets.push('Keep an emergency fund (3–6 months).');
    }

    if (strategy === 'Minimize Expenses') {
      badge = 'TRIM';
      targets.push('Identify top 3 expense categories to cut by 10–20%');
      bullets.push('Cancel unused subscriptions; negotiate bills (insurance, internet).');
      if (Number.isFinite(optDebtBal) && Number.isFinite(optDebtAPR) && optDebtBal > 0 && optDebtAPR >= 10) {
        bullets.push(`Prioritize high-APR debt payoff (${optDebtAPR}% APR) — guaranteed “return.”`);
        targets.push('Use avalanche: pay highest APR first, minimums on others');
      } else {
        bullets.push('If any credit card balances exist, prioritize those first.');
      }
    }

    return { badge, bullets, targets };
  }, [strategy, monthlyIncome, monthlyExpenses, savingsPercent, optDebtAPR, optDebtBal]);

  /* ===== Loans & Payoff Lab (UPDATED) ===== */
  const [loanViewMode, setLoanViewMode] = useState('Simple'); // Simple | Advanced
  const [scenario, setScenario] = useState('Additional principal'); // vs "Refinance impact"

  // Shared loan inputs
  const [labBalance, setLabBalance] = useState(300000);
  const [labAPR, setLabAPR] = useState(6.5);
  const [labYearsRem, setLabYearsRem] = useState(28);

  // Advanced: allow custom current payment
  const [labUseCustomPmt, setLabUseCustomPmt] = useState(false);
  const [labCurrentPmt, setLabCurrentPmt] = useState(NaN);

  // Baseline payment (computed from exact months)
  const baseN = yearsToMonths(labYearsRem);
  const basePayment = useMemo(() => pmtForMonths(labBalance, labAPR, baseN), [labBalance, labAPR, baseN]);
  const effectiveBasePayment = loanViewMode === 'Advanced' && labUseCustomPmt && Number.isFinite(labCurrentPmt) ?
  labCurrentPmt : basePayment;

  // Additional principal scenario (reworked)
  const [extraType, setExtraType] = useState('Recurring monthly'); // or 'One-time lump sum'
  const [extraStartYears, setExtraStartYears] = useState(0);
  const [extraMonthly, setExtraMonthly] = useState(200);
  const [lump1Amt, setLump1Amt] = useState(NaN);
  const [lump1Years, setLump1Years] = useState(1.0);

  // Optional "add additional payment" panel — only lump sum here
  const [addAnother, setAddAnother] = useState(false);
  const [lump2Amt, setLump2Amt] = useState(NaN);
  const [lump2Years, setLump2Years] = useState(2.0);

  // Refinance scenario
  const [refiYears, setRefiYears] = useState(2); // decimals allowed
  const [newAPR, setNewAPR] = useState(5.2);
  const [newTermYears, setNewTermYears] = useState(30);
  const [refiCosts, setRefiCosts] = useState(3000); // only used in Advanced; Simple uses estimate
  const estRefiCosts = useMemo(() => {
    // ~2% of balance, clamped [$1k, $6k]
    return clamp(labBalance * 0.02, 1000, 6000);
  }, [labBalance]);

  // Baseline schedule (no extras)
  const baseSchedule = useMemo(() => {
    return amortizeSchedule({
      balance: labBalance,
      apr: labAPR,
      nMonths: baseN,
      currentPayment: effectiveBasePayment });

  }, [labBalance, labAPR, baseN, effectiveBasePayment]);

  // Scenario schedule
  const altSchedule = useMemo(() => {
    if (scenario === 'Additional principal') {
      const startM = yearsToMonths(extraStartYears);
      const lumps = [];
      if (extraType === 'One-time lump sum' && Number.isFinite(lump1Amt) && lump1Amt > 0) {
        lumps.push({ month: yearsToMonths(lump1Years), amount: lump1Amt });
      }
      if (addAnother && Number.isFinite(lump2Amt) && lump2Amt > 0) {
        lumps.push({ month: yearsToMonths(lump2Years), amount: lump2Amt });
      }
      return amortizeSchedule({
        balance: labBalance,
        apr: labAPR,
        nMonths: baseN,
        currentPayment: effectiveBasePayment,
        extraMonthly: extraType === 'Recurring monthly' ? Math.max(0, extraMonthly || 0) : 0,
        startMonth: extraType === 'Recurring monthly' ? Math.max(1, startM) : 99999,
        lumpSums: lumps });

    } else {
      const costsUsed = loanViewMode === 'Simple' ? estRefiCosts : Math.max(0, refiCosts || 0);
      return refinanceScenario({
        balance: labBalance,
        apr: labAPR,
        yearsRemaining: labYearsRem,
        currentPayment: loanViewMode === 'Advanced' && labUseCustomPmt && Number.isFinite(labCurrentPmt) ? labCurrentPmt : undefined,
        refiYears,
        newAPR,
        newTermYears,
        costs: costsUsed });

    }
  }, [
  scenario, labBalance, labAPR, labYearsRem, baseN, effectiveBasePayment,
  extraType, extraStartYears, extraMonthly, lump1Amt, lump1Years, addAnother, lump2Amt, lump2Years,
  refiYears, newAPR, newTermYears, refiCosts, loanViewMode, estRefiCosts, labUseCustomPmt, labCurrentPmt]);


  const baseTI = baseSchedule.totalInterest;
  const altTI = altSchedule.totalInterest;
  const intSaved = Number.isFinite(baseTI) && Number.isFinite(altTI) ? baseTI - altTI : NaN;
  const monthsSaved = Number.isFinite(baseSchedule.payoffMonth) && Number.isFinite(altSchedule.payoffMonth) ?
  baseSchedule.payoffMonth - altSchedule.payoffMonth :
  NaN;

  const negAmWarning = baseSchedule.negAm || altSchedule.negAm;

  /* Chart metric selection */
  const [chartMetric, setChartMetric] = useState('cumInterest'); // cumInterest | cumPrincipal | balance

  /* ===== Render ===== */
  return /*#__PURE__*/(
    React.createElement("div", { className: "max-w-5xl mx-auto px-4 py-6" }, /*#__PURE__*/

    React.createElement("div", { className: "flex items-start gap-4 mb-4 animate-fadeUp" }, /*#__PURE__*/
    React.createElement("div", {
      className: "w-16 h-16 rounded-2xl bg-yellow-100 flex items-center justify-center text-3xl shadow bouncy select-none",
      "aria-hidden": "true",
      title: "Hi!" }, "\uD83D\uDE42"), /*#__PURE__*/


    React.createElement("div", { className: "flex-1 min-w-0" }, /*#__PURE__*/
    React.createElement("h1", { className: "text-2xl md:text-3xl font-bold tracking-tight" }, "Finance Toolkit"), /*#__PURE__*/
    React.createElement("p", { className: "text-slate-600" }, "Make compounding your superpower. Calm money now, loud money later."), /*#__PURE__*/

    React.createElement("div", { className: "mt-2 flex flex-wrap items-center gap-3" }, /*#__PURE__*/
    React.createElement(CadenceToggle, { cadence: cadence, onChange: handleCadenceChange }), /*#__PURE__*/
    React.createElement(Social, null)))), /*#__PURE__*/





    React.createElement(Section, {
      title: "Pick a Tool",
      right: /*#__PURE__*/React.createElement("span", { className: "text-xs text-slate-500" }, "Everything updates automatically") }, /*#__PURE__*/

    React.createElement("div", { className: "grid grid-cols-5 gap-2" },
    ['Profile', 'Savings & Growth', 'Optimize Plan', 'Loans & Payoff Lab', 'Info'].map((v) => /*#__PURE__*/
    React.createElement("button", {
      key: v,
      onClick: () => setView(v),
      className: (view === v ? 'bg-slate-900 text-white ' : 'bg-white hover:bg-slate-50 ') +
      'border rounded-2xl px-3 py-2 text-left transition-colors' },

    v))), /*#__PURE__*/





    React.createElement("div", { className: "mt-3 flex items-center justify-between text-sm text-slate-600" }, /*#__PURE__*/
    React.createElement("div", { className: "flex items-center gap-2" }, /*#__PURE__*/
    React.createElement("span", { className: "px-2 py-0.5 rounded bg-slate-100" }, "Fun fact"), /*#__PURE__*/
    React.createElement("span", { key: factIdx, className: "animate-fadeUp" }, FUN[factIdx])), /*#__PURE__*/

    React.createElement("button", {
      className: "icon-btn hover:bg-slate-100",
      "aria-label": "Shuffle fun fact",
      title: "Shuffle fun fact",
      onClick: shuffleFact }, /*#__PURE__*/


    React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 24 24", className: "w-4 h-4", fill: "currentColor" }, /*#__PURE__*/
    React.createElement("path", { d: "M7 3v2h.59L5 8.59 6.41 10 10 6.41V7h2V3H7zm10 0h4v4h-2V6.41l-3.29 3.3-1.42-1.42L17.59 5H17V3zM3 13h4v-2H3v2zm6.71 3.29 1.42 1.42L5 23h2v-2h.59l3.3-3.29-1.18-1.42zM19 14h2v4h-4v-2h1.59l-3.29-3.29 1.42-1.42L19 14.59V14z" }))))),






    view === 'Profile' && /*#__PURE__*/
    React.createElement(React.Fragment, null, /*#__PURE__*/

    React.createElement(Section, {
      title: "Income",
      right: /*#__PURE__*/
      React.createElement("div", { className: "text-xs text-slate-500" }, "Mode:",
      ' ', /*#__PURE__*/
      React.createElement("div", { className: "inline-flex rounded-full border bg-white overflow-hidden align-middle ml-1" },
      ['Simple', 'Advanced'].map((m) => /*#__PURE__*/
      React.createElement("button", {
        key: m,
        onClick: () => setIncMode(m),
        className: (incMode === m ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50') + ' px-2 py-1' },
      m)))) },





    incMode === 'Simple' ? /*#__PURE__*/
    React.createElement("div", { className: "grid sm:grid-cols-3 gap-4" }, /*#__PURE__*/
    React.createElement("div", { className: "sm:col-span-2" }, /*#__PURE__*/
    React.createElement("label", { className: "block text-sm font-medium" },
    cadence, " income ", /*#__PURE__*/React.createElement(Info, { tip: `Enter your ${cadence.toLowerCase()} gross income. We'll show the conversion below and estimate federal taxes for a single filer (approx).` })), /*#__PURE__*/

    React.createElement(CurrencyInput, {
      value: incSimple,
      onChange: setIncSimple,
      placeholder: cadence === 'Monthly' ? fmtCurrency0(medianMonthlyIncome) : fmtCurrency0(medianAnnualIncome) }), /*#__PURE__*/

    React.createElement("div", { className: "text-[11px] text-slate-500 mt-1" }, "Est. federal effective tax (single): ",
    fmtPercent1(estFedTaxSingleEffective(Number.isFinite(incSimple) ? cadence === 'Monthly' ? incSimple * 12 : incSimple : NaN).effective)))) : /*#__PURE__*/




    React.createElement("div", { className: "grid sm:grid-cols-3 gap-4" }, /*#__PURE__*/
    React.createElement("div", null, /*#__PURE__*/
    React.createElement("label", { className: "block text-sm font-medium" }, "Work (",
    cadence, ") ", /*#__PURE__*/React.createElement(Info, { tip: "Salary/wages before tax." })), /*#__PURE__*/

    React.createElement(CurrencyInput, {
      value: incWork,
      onChange: setIncWork,
      placeholder: cadence === 'Monthly' ? fmtCurrency0(medianMonthlyIncome * 0.8) : fmtCurrency0(medianAnnualIncome * 0.8) })), /*#__PURE__*/


    React.createElement("div", null, /*#__PURE__*/
    React.createElement("label", { className: "block text-sm font-medium" }, "Hustle (",
    cadence, ") ", /*#__PURE__*/React.createElement(Info, { tip: "Side gigs, freelance, small business income." })), /*#__PURE__*/

    React.createElement(CurrencyInput, {
      value: incHustle,
      onChange: setIncHustle,
      placeholder: cadence === 'Monthly' ? fmtCurrency0(300) : fmtCurrency0(3600) })), /*#__PURE__*/


    React.createElement("div", null, /*#__PURE__*/
    React.createElement("label", { className: "block text-sm font-medium" }, "Tenants (",
    cadence, ") ", /*#__PURE__*/React.createElement(Info, { tip: "Rental income (net of vacancy/maintenance if possible)." })), /*#__PURE__*/

    React.createElement(CurrencyInput, {
      value: incTenants,
      onChange: setIncTenants,
      placeholder: cadence === 'Monthly' ? fmtCurrency0(1200) : fmtCurrency0(14400) })))), /*#__PURE__*/







    React.createElement(Section, {
      title: "Expenses",
      right: /*#__PURE__*/
      React.createElement("div", { className: "text-xs text-slate-500" }, "Mode:",
      ' ', /*#__PURE__*/
      React.createElement("div", { className: "inline-flex rounded-full border bg-white overflow-hidden align-middle ml-1" },
      ['Simple', 'Advanced'].map((m) => /*#__PURE__*/
      React.createElement("button", {
        key: m,
        onClick: () => setExpMode(m),
        className: (expMode === m ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50') + ' px-2 py-1' },
      m)))) },





    expMode === 'Simple' ? /*#__PURE__*/
    React.createElement("div", { className: "grid sm:grid-cols-2 gap-4" }, /*#__PURE__*/
    React.createElement("div", null, /*#__PURE__*/
    React.createElement("label", { className: "block text-sm font-medium" },
    cadence, " expenses total ", /*#__PURE__*/React.createElement(Info, { tip: `Enter your ${cadence.toLowerCase()} total spending across categories.` })), /*#__PURE__*/

    React.createElement(CurrencyInput, {
      value: expSimple,
      onChange: setExpSimple,
      placeholder: cadence === 'Monthly' ? fmtCurrency0(medianMonthlyExpenses) : fmtCurrency0(medianMonthlyExpenses * 12) }))) : /*#__PURE__*/




    React.createElement("div", { className: "grid sm:grid-cols-3 gap-4" }, /*#__PURE__*/
    React.createElement("div", null, /*#__PURE__*/
    React.createElement("label", { className: "block text-sm font-medium" }, "Housing (", cadence, ")"), /*#__PURE__*/
    React.createElement(CurrencyInput, { value: expHousing, onChange: setExpHousing, placeholder: cadence === 'Monthly' ? fmtCurrency0(1800) : fmtCurrency0(21600) })), /*#__PURE__*/

    React.createElement("div", null, /*#__PURE__*/
    React.createElement("label", { className: "block text-sm font-medium" }, "Auto/Transport (", cadence, ")"), /*#__PURE__*/
    React.createElement(CurrencyInput, { value: expAuto, onChange: setExpAuto, placeholder: cadence === 'Monthly' ? fmtCurrency0(600) : fmtCurrency0(7200) })), /*#__PURE__*/

    React.createElement("div", null, /*#__PURE__*/
    React.createElement("label", { className: "block text-sm font-medium" }, "Food (", cadence, ")"), /*#__PURE__*/
    React.createElement(CurrencyInput, { value: expFood, onChange: setExpFood, placeholder: cadence === 'Monthly' ? fmtCurrency0(600) : fmtCurrency0(7200) })), /*#__PURE__*/

    React.createElement("div", null, /*#__PURE__*/
    React.createElement("label", { className: "block text-sm font-medium" }, "Entertainment (", cadence, ")"), /*#__PURE__*/
    React.createElement(CurrencyInput, { value: expEntertainment, onChange: setExpEntertainment, placeholder: cadence === 'Monthly' ? fmtCurrency0(250) : fmtCurrency0(3000) })), /*#__PURE__*/

    React.createElement("div", null, /*#__PURE__*/
    React.createElement("label", { className: "block text-sm font-medium" }, "Insurance (", cadence, ")"), /*#__PURE__*/
    React.createElement(CurrencyInput, { value: expInsurance, onChange: setExpInsurance, placeholder: cadence === 'Monthly' ? fmtCurrency0(400) : fmtCurrency0(4800) })), /*#__PURE__*/

    React.createElement("div", null, /*#__PURE__*/
    React.createElement("label", { className: "block text-sm font-medium" }, "Utilities (", cadence, ")"), /*#__PURE__*/
    React.createElement(CurrencyInput, { value: expUtilities, onChange: setExpUtilities, placeholder: cadence === 'Monthly' ? fmtCurrency0(300) : fmtCurrency0(3600) })), /*#__PURE__*/

    React.createElement("div", { className: "sm:col-span-3" }, /*#__PURE__*/
    React.createElement("label", { className: "block text-sm font-medium" }, "Other (", cadence, ")"), /*#__PURE__*/
    React.createElement(CurrencyInput, { value: expOther, onChange: setExpOther, placeholder: cadence === 'Monthly' ? fmtCurrency0(200) : fmtCurrency0(2400) })))), /*#__PURE__*/






    React.createElement(Section, {
      title: "Savings",
      right: /*#__PURE__*/
      React.createElement("div", { className: "text-xs text-slate-500" }, "Mode:",
      ' ', /*#__PURE__*/
      React.createElement("div", { className: "inline-flex rounded-full border bg-white overflow-hidden align-middle ml-1" },
      ['Simple', 'Advanced'].map((m) => /*#__PURE__*/
      React.createElement("button", {
        key: m,
        onClick: () => setSavMode(m),
        className: (savMode === m ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50') + ' px-2 py-1' },
      m)))) },





    savMode === 'Simple' ? /*#__PURE__*/
    React.createElement("div", { className: "grid sm:grid-cols-2 gap-4" }, /*#__PURE__*/
    React.createElement("div", null, /*#__PURE__*/
    React.createElement("label", { className: "block text-sm font-medium" }, "Liquid savings (USD) ", /*#__PURE__*/
    React.createElement(Info, { tip: "Cash & cash equivalents readily available." })), /*#__PURE__*/

    React.createElement(CurrencyInput, {
      value: liquidSavings,
      onChange: setLiquidSavings,
      placeholder: fmtCurrency0(medianLiquidSavings) }))) : /*#__PURE__*/




    React.createElement("div", { className: "grid sm:grid-cols-2 gap-4" }, /*#__PURE__*/
    React.createElement("div", null, /*#__PURE__*/
    React.createElement("label", { className: "block text-sm font-medium" }, "Emergency fund (USD)"), /*#__PURE__*/
    React.createElement(CurrencyInput, { value: balEmergency, onChange: setBalEmergency, placeholder: fmtCurrency0(6000) })), /*#__PURE__*/

    React.createElement("div", null, /*#__PURE__*/
    React.createElement("label", { className: "block text-sm font-medium" }, "Retirement \u2013 pretax (USD)"), /*#__PURE__*/
    React.createElement(CurrencyInput, { value: balPretax, onChange: setBalPretax, placeholder: fmtCurrency0(35000) })), /*#__PURE__*/

    React.createElement("div", null, /*#__PURE__*/
    React.createElement("label", { className: "block text-sm font-medium" }, "Retirement \u2013 Roth (USD)"), /*#__PURE__*/
    React.createElement(CurrencyInput, { value: balRoth, onChange: setBalRoth, placeholder: fmtCurrency0(12000) })), /*#__PURE__*/

    React.createElement("div", null, /*#__PURE__*/
    React.createElement("label", { className: "block text-sm font-medium" }, "Taxable brokerage (USD)"), /*#__PURE__*/
    React.createElement(CurrencyInput, { value: balTaxable, onChange: setBalTaxable, placeholder: fmtCurrency0(8000) })))), /*#__PURE__*/






    React.createElement(Section, { title: "Financial Health Snapshot", right: /*#__PURE__*/React.createElement("span", { className: "text-xs text-slate-500" }, "Monthly analysis") }, /*#__PURE__*/
    React.createElement("div", { className: "grid md:grid-cols-2 gap-4" }, /*#__PURE__*/
    React.createElement("div", { className: "p-3 rounded-xl border bg-white/60" }, /*#__PURE__*/
    React.createElement("div", { className: "font-medium mb-1 flex items-center" }, "Disposable income / savings capacity", /*#__PURE__*/

    React.createElement(Info, { tip: "Disposable income (monthly) = Monthly income − Monthly expenses.\nThis is what you can direct to goals (emergency fund, investing, debt prepayment)." })), /*#__PURE__*/

    React.createElement("div", { className: "text-sm" }, /*#__PURE__*/
    React.createElement("span", { className: "font-semibold" }, /*#__PURE__*/React.createElement(SmoothNumber, { value: dispoMonthly, format: "usd0" })), " per month"), /*#__PURE__*/

    React.createElement("p", { className: "text-xs text-slate-500 mt-1" }, "That\u2019s about ",
    fmtPercent1(savingsPercent), " of income.")), /*#__PURE__*/



    React.createElement("div", { className: "p-3 rounded-xl border bg-white/60" }, /*#__PURE__*/
    React.createElement("div", { className: "font-medium mb-1 flex items-center" }, "Emergency Fund", /*#__PURE__*/

    React.createElement(Info, { tip: "Months of expenses your savings can cover.\n3–6 months is a common guideline; more if income varies." })), /*#__PURE__*/

    React.createElement("div", { className: "text-sm" }, "~ ", /*#__PURE__*/
    React.createElement("span", { className: "font-semibold" }, /*#__PURE__*/
    React.createElement(SmoothNumber, {
      value: Number.isFinite(totalSavingsBalance) && Number.isFinite(monthlyExpenses) && monthlyExpenses > 0 ?
      totalSavingsBalance / monthlyExpenses : NaN,
      format: "one" })), " months"), /*#__PURE__*/



    React.createElement("p", { className: "text-xs text-slate-500 mt-1" }, "Balances include liquid + (optionally) other accounts in Advanced."))))),







    view === 'Savings & Growth' && /*#__PURE__*/
    React.createElement(React.Fragment, null, /*#__PURE__*/
    React.createElement(Section, { title: "Savings & Growth", right: /*#__PURE__*/React.createElement("span", { className: "text-xs text-slate-500" }, "Monthly contributions") }, /*#__PURE__*/
    React.createElement("div", { className: "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4" }, /*#__PURE__*/
    React.createElement("div", null, /*#__PURE__*/
    React.createElement("label", { className: "block text-sm font-medium" }, "Initial amount (USD)"), /*#__PURE__*/
    React.createElement(CurrencyInput, { value: sgPrincipal, onChange: setSgPrincipal, placeholder: fmtCurrency0(10000) })), /*#__PURE__*/

    React.createElement("div", null, /*#__PURE__*/
    React.createElement("label", { className: "block text-sm font-medium" }, "Monthly contribution (USD)"), /*#__PURE__*/
    React.createElement(CurrencyInput, { value: sgMonthly, onChange: setSgMonthly, placeholder: fmtCurrency0(500) })), /*#__PURE__*/

    React.createElement("div", null, /*#__PURE__*/
    React.createElement("label", { className: "block text-sm font-medium" }, "Annual return (%) ", /*#__PURE__*/React.createElement(Info, { tip: "Average annual return assumption (long horizon)." })), /*#__PURE__*/
    React.createElement("input", { type: "number", step: "0.1", className: "field", value: Number.isFinite(sgAPR) ? sgAPR : '', placeholder: "7", onChange: e => setSgAPR(parseFloat(e.target.value)) })), /*#__PURE__*/

    React.createElement("div", null, /*#__PURE__*/
    React.createElement("label", { className: "block text-sm font-medium" }, "Years"), /*#__PURE__*/
    React.createElement("input", { type: "number", className: "field", value: Number.isFinite(sgYears) ? sgYears : '', placeholder: "30", onChange: e => setSgYears(parseFloat(e.target.value)) })), /*#__PURE__*/

    React.createElement("div", null, /*#__PURE__*/
    React.createElement("label", { className: "block text-sm font-medium" }, "Goal amount (optional)"), /*#__PURE__*/
    React.createElement(CurrencyInput, { value: goalFV, onChange: setGoalFV, placeholder: fmtCurrency0(1000000) }))), /*#__PURE__*/



    React.createElement("div", { className: "grid md:grid-cols-3 gap-3 mt-4" }, /*#__PURE__*/
    React.createElement("div", { className: "p-3 rounded-xl border bg-white/60" }, /*#__PURE__*/
    React.createElement("div", { className: "font-medium mb-1 flex items-center" }, "Projected future value ", /*#__PURE__*/React.createElement(Info, { tip: "Assumes monthly deposits at month-end; ignores taxes/fees.\nUse for rough planning only." })), /*#__PURE__*/
    React.createElement("div", { className: "text-sm" }, /*#__PURE__*/React.createElement(SmoothNumber, { value: sgFV, format: "usd0" }))), /*#__PURE__*/

    React.createElement("div", { className: "p-3 rounded-xl border bg-white/60" }, /*#__PURE__*/
    React.createElement("div", { className: "font-medium mb-1" }, "If you targeted the goal\u2026"), /*#__PURE__*/
    React.createElement("div", { className: "text-sm" }, "Required monthly: ", /*#__PURE__*/React.createElement(SmoothNumber, { value: sgReqMonthly, format: "usd0" }))), /*#__PURE__*/


    React.createElement("div", { className: "p-3 rounded-xl border bg-white/60" }, /*#__PURE__*/
    React.createElement("div", { className: "font-medium mb-1 flex items-center" }, "Mortgage / Loan", /*#__PURE__*/
    React.createElement(Info, { tip: "Fixed-rate, fully amortized. Payment includes principal & interest." })), /*#__PURE__*/

    React.createElement("div", { className: "grid grid-cols-3 gap-2 text-xs" }, /*#__PURE__*/
    React.createElement("div", null, /*#__PURE__*/
    React.createElement("label", { className: "block text-[11px] text-slate-600" }, "Principal"), /*#__PURE__*/
    React.createElement(CurrencyInput, { value: loanP, onChange: setLoanP, placeholder: fmtCurrency0(250000) })), /*#__PURE__*/

    React.createElement("div", null, /*#__PURE__*/
    React.createElement("label", { className: "block text-[11px] text-slate-600" }, "APR %"), /*#__PURE__*/
    React.createElement("input", { type: "number", step: "0.1", className: "field", value: Number.isFinite(loanAPR) ? loanAPR : '', onChange: e => setLoanAPR(parseFloat(e.target.value)), placeholder: "4" })), /*#__PURE__*/

    React.createElement("div", null, /*#__PURE__*/
    React.createElement("label", { className: "block text-[11px] text-slate-600" }, "Years"), /*#__PURE__*/
    React.createElement("input", { type: "number", className: "field", value: Number.isFinite(loanYears) ? loanYears : '', onChange: e => setLoanYears(parseFloat(e.target.value)), placeholder: "30" }))), /*#__PURE__*/


    React.createElement("div", { className: "text-sm mt-2" }, "Monthly: ", /*#__PURE__*/React.createElement(SmoothNumber, { value: loan.pmt, format: "usd0" })), /*#__PURE__*/
    React.createElement("div", { className: "text-xs text-slate-600" }, "Total interest: ", /*#__PURE__*/React.createElement(SmoothNumber, { value: loan.totalInterest, format: "usd0" })))), /*#__PURE__*/



    React.createElement("div", { className: "text-xs text-slate-600 mt-2" }, "These are simplified calculations. For taxes, fees, and volatility, consult more detailed tools or a professional."))),







    view === 'Optimize Plan' && /*#__PURE__*/
    React.createElement(React.Fragment, null, /*#__PURE__*/
    React.createElement(Section, { title: "Optimize Plan", right: /*#__PURE__*/React.createElement("span", { className: "text-xs text-slate-500" }, "Monthly analysis") }, /*#__PURE__*/
    React.createElement("div", { className: "grid sm:grid-cols-3 gap-3 mb-3" }, /*#__PURE__*/
    React.createElement("div", null, /*#__PURE__*/
    React.createElement("label", { className: "block text-sm font-medium" }, "Strategy"), /*#__PURE__*/
    React.createElement("select", { className: "field", value: strategy, onChange: e => setStrategy(e.target.value) }, /*#__PURE__*/
    React.createElement("option", null, "FIRE"), /*#__PURE__*/
    React.createElement("option", null, "Maximize Retirement"), /*#__PURE__*/
    React.createElement("option", null, "Minimize Expenses"))),



    strategy === 'Minimize Expenses' && /*#__PURE__*/
    React.createElement(React.Fragment, null, /*#__PURE__*/
    React.createElement("div", null, /*#__PURE__*/
    React.createElement("label", { className: "block text-sm font-medium" }, "High-APR debt balance (optional)"), /*#__PURE__*/
    React.createElement(CurrencyInput, { value: optDebtBal, onChange: setOptDebtBal, placeholder: fmtCurrency0(4000) })), /*#__PURE__*/

    React.createElement("div", null, /*#__PURE__*/
    React.createElement("label", { className: "block text-sm font-medium" }, "High-APR debt rate (%)"), /*#__PURE__*/
    React.createElement("input", { type: "number", step: "0.1", className: "field", value: Number.isFinite(optDebtAPR) ? optDebtAPR : '', placeholder: "18", onChange: e => setOptDebtAPR(parseFloat(e.target.value)) })))), /*#__PURE__*/





    React.createElement("div", { className: "p-3 rounded-2xl border bg-gradient-to-b from-white to-slate-50" }, /*#__PURE__*/
    React.createElement("div", { className: "flex items-center justify-between mb-2" }, /*#__PURE__*/
    React.createElement("div", { className: "text-lg font-semibold" }, "Recommendation"), /*#__PURE__*/
    React.createElement("div", { className: "text-xs text-slate-500" }, "Emergency \u2192 Debt \u2192 Invest")), /*#__PURE__*/


    React.createElement("div", { className: "space-y-2 animate-fadeUp" }, /*#__PURE__*/
    React.createElement("div", { className: "flex flex-wrap items-center gap-2" }, /*#__PURE__*/
    React.createElement("span", { className: "px-2 py-0.5 rounded-full text-xs border bg-white" }, rec.badge),
    rec.targets.length > 0 ? /*#__PURE__*/
    React.createElement("span", { className: "text-sm text-slate-700" }, "Targets:",

    rec.targets.map((t) => /*#__PURE__*/
    React.createElement("span", { key: t, className: "inline-block ml-2 px-2 py-0.5 rounded-full border bg-white" }, t))) : /*#__PURE__*/



    React.createElement("span", { className: "text-sm text-slate-500" }, "Provide inputs to show targets")), /*#__PURE__*/



    React.createElement("div", { className: "mt-1 text-sm space-y-2" }, /*#__PURE__*/
    React.createElement("div", { className: "font-medium text-slate-700" }, "Because"), /*#__PURE__*/
    React.createElement("ul", { className: "list-disc pl-5 space-y-1" },
    rec.bullets.map((b, i) => /*#__PURE__*/React.createElement("li", { key: i }, b)))), /*#__PURE__*/



    React.createElement("div", { className: "text-xs text-slate-600" }, "Notes: Educational content, not individualized advice."))))),









    view === 'Loans & Payoff Lab' && /*#__PURE__*/
    React.createElement(React.Fragment, null, /*#__PURE__*/
    React.createElement(Section, {
      title: "Loans & Payoff Lab",
      right: /*#__PURE__*/React.createElement("span", { className: "text-xs text-slate-500" }, "Visualize interest savings") }, /*#__PURE__*/


    React.createElement("div", { className: "grid sm:grid-cols-4 gap-3" }, /*#__PURE__*/
    React.createElement("div", null, /*#__PURE__*/
    React.createElement("label", { className: "block text-sm font-medium" }, "Balance (USD)"), /*#__PURE__*/
    React.createElement(CurrencyInput, { value: labBalance, onChange: setLabBalance, placeholder: fmtCurrency0(300000) }), /*#__PURE__*/
    React.createElement("div", { className: "text-[11px] text-slate-500 mt-1" }, "Est. monthly payment: ", /*#__PURE__*/
    React.createElement("strong", null, fmtCurrency0(basePayment)))), /*#__PURE__*/


    React.createElement("div", null, /*#__PURE__*/
    React.createElement("label", { className: "block text-sm font-medium" }, "APR %"), /*#__PURE__*/
    React.createElement("input", { type: "number", step: "0.01", className: "field", value: Number.isFinite(labAPR) ? labAPR : '', onChange: e => setLabAPR(parseFloat(e.target.value)), placeholder: "6.5" })), /*#__PURE__*/

    React.createElement("div", null, /*#__PURE__*/
    React.createElement("label", { className: "block text-sm font-medium" }, "Years remaining"), /*#__PURE__*/
    React.createElement("input", { type: "number", step: "0.01", className: "field", value: Number.isFinite(labYearsRem) ? labYearsRem : '', onChange: e => setLabYearsRem(parseFloat(e.target.value)), placeholder: "28" })),



    loanViewMode === 'Advanced' && /*#__PURE__*/
    React.createElement("div", null, /*#__PURE__*/
    React.createElement("label", { className: "block text-sm font-medium" }, "Payment input (Advanced)"), /*#__PURE__*/
    React.createElement("label", { className: "inline-flex items-center text-xs mt-1" }, /*#__PURE__*/
    React.createElement("input", { type: "checkbox", className: "mr-2", checked: labUseCustomPmt, onChange: e => setLabUseCustomPmt(e.target.checked) }), "Use current payment"),


    labUseCustomPmt && /*#__PURE__*/
    React.createElement("div", { className: "mt-1" }, /*#__PURE__*/
    React.createElement(CurrencyInput, { value: labCurrentPmt, onChange: setLabCurrentPmt, placeholder: fmtCurrency0(basePayment) })))), /*#__PURE__*/







    React.createElement("div", { className: "mt-3 grid sm:grid-cols-3 gap-3" }, /*#__PURE__*/
    React.createElement("div", { className: "text-xs text-slate-500" }, "Mode:",
    ' ', /*#__PURE__*/
    React.createElement("div", { className: "inline-flex rounded-full border bg-white overflow-hidden align-middle ml-1" },
    ['Simple', 'Advanced'].map((m) => /*#__PURE__*/
    React.createElement("button", {
      key: m,
      onClick: () => setLoanViewMode(m),
      className: (loanViewMode === m ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50') + ' px-2 py-1' },
    m)))), /*#__PURE__*/



    React.createElement("div", { className: "sm:col-span-2" }, /*#__PURE__*/
    React.createElement("label", { className: "block text-sm font-medium" }, "Scenario", /*#__PURE__*/

    React.createElement(Info, {
      tip: "In Simple mode, refinancing costs are assumed ≈ 2% of current balance (min $1,000, max $6,000). In Advanced, you can enter a custom cost." })), /*#__PURE__*/



    React.createElement("select", { className: "field", value: scenario, onChange: e => setScenario(e.target.value) }, /*#__PURE__*/
    React.createElement("option", null, "Additional principal"), /*#__PURE__*/
    React.createElement("option", null, "Refinance impact")))),





    scenario === 'Additional principal' ? /*#__PURE__*/
    React.createElement(React.Fragment, null, /*#__PURE__*/
    React.createElement("div", { className: "grid sm:grid-cols-3 gap-3 mt-3" }, /*#__PURE__*/
    React.createElement("div", null, /*#__PURE__*/
    React.createElement("label", { className: "block text-sm font-medium" }, "Type"), /*#__PURE__*/
    React.createElement("select", { className: "field", value: extraType, onChange: e => setExtraType(e.target.value) }, /*#__PURE__*/
    React.createElement("option", null, "Recurring monthly"), /*#__PURE__*/
    React.createElement("option", null, "One-time lump sum"))), /*#__PURE__*/


    React.createElement("div", null, /*#__PURE__*/
    React.createElement("label", { className: "block text-sm font-medium" }, "Start in (years)"), /*#__PURE__*/
    React.createElement("input", {
      type: "number",
      step: "0.01",
      className: "field",
      value: Number.isFinite(extraStartYears) ? extraStartYears : '',
      onChange: e => setExtraStartYears(parseFloat(e.target.value)),
      placeholder: "0" }), /*#__PURE__*/

    React.createElement("div", { className: "text-[11px] text-slate-500 mt-1" }, "Decimals allowed for partial years.")), /*#__PURE__*/

    React.createElement("div", null,
    extraType === 'Recurring monthly' ? /*#__PURE__*/
    React.createElement(React.Fragment, null, /*#__PURE__*/
    React.createElement("label", { className: "block text-sm font-medium" }, "Extra monthly (USD)"), /*#__PURE__*/
    React.createElement(CurrencyInput, { value: extraMonthly, onChange: setExtraMonthly, placeholder: fmtCurrency0(200) })) : /*#__PURE__*/


    React.createElement(React.Fragment, null, /*#__PURE__*/
    React.createElement("label", { className: "block text-sm font-medium" }, "Lump sum (USD)"), /*#__PURE__*/
    React.createElement(CurrencyInput, { value: lump1Amt, onChange: setLump1Amt, placeholder: fmtCurrency0(3000) }), /*#__PURE__*/
    React.createElement("div", { className: "text-[11px] text-slate-500 mt-1" }, "Will occur at the start year above.")))), /*#__PURE__*/






    React.createElement("div", { className: "mt-3 p-3 rounded-xl border bg-white/50" }, /*#__PURE__*/
    React.createElement("label", { className: "inline-flex items-center text-sm font-medium" }, /*#__PURE__*/
    React.createElement("input", { type: "checkbox", className: "mr-2", checked: addAnother, onChange: e => setAddAnother(e.target.checked) }), "Add additional payment"),


    addAnother && /*#__PURE__*/
    React.createElement("div", { className: "grid sm:grid-cols-3 gap-3 mt-2" }, /*#__PURE__*/
    React.createElement("div", { className: "sm:col-span-3 text-[11px] text-slate-500" }, "Only lump-sum is available here \u2014 to increase a recurring monthly amount, please adjust the \u201CExtra monthly\u201D field above."), /*#__PURE__*/


    React.createElement("div", null, /*#__PURE__*/
    React.createElement("label", { className: "block text-sm font-medium" }, "Extra lump sum (USD)"), /*#__PURE__*/
    React.createElement(CurrencyInput, { value: lump2Amt, onChange: setLump2Amt, placeholder: fmtCurrency0(2000) })), /*#__PURE__*/

    React.createElement("div", null, /*#__PURE__*/
    React.createElement("label", { className: "block text-sm font-medium" }, "Occurs in (years)"), /*#__PURE__*/
    React.createElement("input", { type: "number", step: "0.01", className: "field", value: Number.isFinite(lump2Years) ? lump2Years : '', onChange: e => setLump2Years(parseFloat(e.target.value)), placeholder: "2.0" }))))) : /*#__PURE__*/






    React.createElement(React.Fragment, null, /*#__PURE__*/
    React.createElement("div", { className: "grid sm:grid-cols-4 gap-3 mt-3" }, /*#__PURE__*/
    React.createElement("div", null, /*#__PURE__*/
    React.createElement("label", { className: "block text-sm font-medium" }, "Refi in (years)"), /*#__PURE__*/
    React.createElement("input", { type: "number", step: "0.01", className: "field", value: Number.isFinite(refiYears) ? refiYears : '', onChange: e => setRefiYears(parseFloat(e.target.value)), placeholder: "2.0" }), /*#__PURE__*/
    React.createElement("div", { className: "text-[11px] text-slate-500 mt-1" }, "Decimals allowed.")), /*#__PURE__*/

    React.createElement("div", null, /*#__PURE__*/
    React.createElement("label", { className: "block text-sm font-medium" }, "New APR %"), /*#__PURE__*/
    React.createElement("input", { type: "number", step: "0.01", className: "field", value: Number.isFinite(newAPR) ? newAPR : '', onChange: e => setNewAPR(parseFloat(e.target.value)), placeholder: "5.2" })), /*#__PURE__*/

    React.createElement("div", null, /*#__PURE__*/
    React.createElement("label", { className: "block text-sm font-medium" }, "New term (years)"), /*#__PURE__*/
    React.createElement("input", { type: "number", step: "0.01", className: "field", value: Number.isFinite(newTermYears) ? newTermYears : '', onChange: e => setNewTermYears(parseFloat(e.target.value)), placeholder: "30" })),

    loanViewMode === 'Advanced' ? /*#__PURE__*/
    React.createElement("div", null, /*#__PURE__*/
    React.createElement("label", { className: "block text-sm font-medium" }, "Refi costs (USD)"), /*#__PURE__*/
    React.createElement(CurrencyInput, { value: refiCosts, onChange: setRefiCosts, placeholder: fmtCurrency0(estRefiCosts) })) :

    null),




    Number.isFinite(altSchedule === null || altSchedule === void 0 ? void 0 : altSchedule.newPayment) && /*#__PURE__*/
    React.createElement("div", { className: "mt-2 text-[11px] text-slate-600" }, "New estimated payment after refi: ", /*#__PURE__*/
    React.createElement("strong", null, fmtCurrency0(altSchedule.newPayment)), " / mo")), /*#__PURE__*/






    React.createElement("div", { className: "p-3 rounded-xl border bg-white/60 mt-4" }, /*#__PURE__*/
    React.createElement("div", { className: "font-medium mb-2 flex items-center" }, "Results", /*#__PURE__*/

    React.createElement(Info, { tip: "Baseline uses your balance/APR/term (or Advanced payment).\nScenario applies the chosen extras or refinance.\nBelow, see payoff months, interest, and payments side-by-side." })), /*#__PURE__*/


    React.createElement("div", { className: "overflow-auto" }, /*#__PURE__*/
    React.createElement("table", { className: "w-full text-sm" }, /*#__PURE__*/
    React.createElement("thead", { className: "text-left text-slate-500" }, /*#__PURE__*/
    React.createElement("tr", null, /*#__PURE__*/
    React.createElement("th", { className: "py-1 pr-2" }), /*#__PURE__*/
    React.createElement("th", { className: "py-1 pr-2" }, "Baseline"), /*#__PURE__*/
    React.createElement("th", { className: "py-1" }, "Scenario"))), /*#__PURE__*/


    React.createElement("tbody", { className: "align-top" }, /*#__PURE__*/
    React.createElement("tr", { className: "border-t" }, /*#__PURE__*/
    React.createElement("td", { className: "py-2 pr-2 font-medium" }, "Monthly payment"), /*#__PURE__*/
    React.createElement("td", { className: "py-2 pr-2" }, /*#__PURE__*/React.createElement(SmoothNumber, { value: effectiveBasePayment, format: "usd0" })), /*#__PURE__*/
    React.createElement("td", { className: "py-2" },
    scenario === 'Refinance impact' ? /*#__PURE__*/
    React.createElement(SmoothNumber, { value: altSchedule === null || altSchedule === void 0 ? void 0 : altSchedule.newPayment, format: "usd0" }) : /*#__PURE__*/
    React.createElement(React.Fragment, null, /*#__PURE__*/
    React.createElement(SmoothNumber, { value: effectiveBasePayment, format: "usd0" }),
    extraType === 'Recurring monthly' && Number.isFinite(extraMonthly) && extraMonthly > 0 && /*#__PURE__*/
    React.createElement("div", { className: "text-[11px] text-slate-500" }, "+ extra principal ", /*#__PURE__*/React.createElement("strong", null, fmtCurrency0(extraMonthly)))))), /*#__PURE__*/





    React.createElement("tr", { className: "border-t" }, /*#__PURE__*/
    React.createElement("td", { className: "py-2 pr-2 font-medium" }, "Payoff time (months)"), /*#__PURE__*/
    React.createElement("td", { className: "py-2 pr-2" }, /*#__PURE__*/React.createElement(SmoothNumber, { value: baseSchedule.payoffMonth, format: "int" })), /*#__PURE__*/
    React.createElement("td", { className: "py-2" }, /*#__PURE__*/React.createElement(SmoothNumber, { value: altSchedule.payoffMonth, format: "int" }))), /*#__PURE__*/

    React.createElement("tr", { className: "border-t" }, /*#__PURE__*/
    React.createElement("td", { className: "py-2 pr-2 font-medium" }, "Total interest remaining"), /*#__PURE__*/
    React.createElement("td", { className: "py-2 pr-2" }, /*#__PURE__*/React.createElement(SmoothNumber, { value: baseSchedule.totalInterest, format: "usd0" })), /*#__PURE__*/
    React.createElement("td", { className: "py-2" }, /*#__PURE__*/React.createElement(SmoothNumber, { value: altSchedule.totalInterest, format: "usd0" })))))), /*#__PURE__*/





    React.createElement("div", { className: "mt-2 border-t pt-2 text-sm" }, "Interest saved: ", /*#__PURE__*/
    React.createElement("strong", null, /*#__PURE__*/React.createElement(SmoothNumber, { value: intSaved, format: "usd0" })), ' ', "| Months saved: ", /*#__PURE__*/
    React.createElement("strong", null, /*#__PURE__*/React.createElement(SmoothNumber, { value: monthsSaved, format: "int" }))),


    negAmWarning && /*#__PURE__*/
    React.createElement("div", { className: "mt-2 text-xs text-red-600" }, "Warning: Payment appears too low to cover interest (negative amortization).")), /*#__PURE__*/






    React.createElement("div", { className: "mt-4 p-3 rounded-xl border bg-white/60" }, /*#__PURE__*/
    React.createElement("div", { className: "flex items-center justify-between mb-2" }, /*#__PURE__*/
    React.createElement("div", { className: "font-medium" }, "Chart"), /*#__PURE__*/
    React.createElement("div", { className: "text-xs" }, /*#__PURE__*/
    React.createElement("label", { className: "mr-2 text-slate-600" }, "Metric"), /*#__PURE__*/
    React.createElement("select", { className: "field inline-block w-auto", value: chartMetric, onChange: e => setChartMetric(e.target.value) }, /*#__PURE__*/
    React.createElement("option", { value: "cumInterest" }, "Total interest payments"), /*#__PURE__*/
    React.createElement("option", { value: "cumPrincipal" }, "Total principal payments")))), /*#__PURE__*/





    React.createElement(InterestChart, { baseRows: baseSchedule.rows, altRows: altSchedule.rows, metric: chartMetric })), /*#__PURE__*/


    React.createElement("div", { className: "text-xs text-slate-600 mt-2" }, "Educational tool; ignores taxes/escrow/PMI and assumes fixed rate & on-time payments."))),







    view === 'Info' && /*#__PURE__*/
    React.createElement(React.Fragment, null, /*#__PURE__*/
    React.createElement(Section, { title: "Info", right: /*#__PURE__*/React.createElement("span", { className: "text-xs text-slate-500" }, "Quick references") }, /*#__PURE__*/
    React.createElement(InfoPanel, null))), /*#__PURE__*/





    React.createElement("div", { className: "text-center text-xs text-slate-500 space-y-2 mt-8 mb-8" }, /*#__PURE__*/
    React.createElement("div", null, /*#__PURE__*/React.createElement("a", { className: "underline", href: "https://www.investor.gov", target: "_blank", rel: "noreferrer" }, "Investor.gov")), /*#__PURE__*/
    React.createElement("div", null, "Built for clarity, not financial advice. Consult a professional for personalized recommendations."))));



}

/* Mount */
ReactDOM.createRoot(document.getElementById('root')).render( /*#__PURE__*/React.createElement(App, null));