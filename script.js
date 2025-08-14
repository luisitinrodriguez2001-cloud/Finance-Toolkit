/* Finance Toolkit — JS (paste into CodePen JS with Babel/JSX)
   Updates:
   - Converts existing Profile inputs when switching Monthly ↔ Annual
   - Moves cadence toggle + social under the subtitle (better on phones)
   - Renames "Savings Rate" → "Disposable income / savings capacity"
   - Shows capacity as $/mo plus a small % of income
*/
const { useState, useMemo, useEffect, useRef } = React;

/* =========================
   Number & currency helpers
========================= */
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const toNum = v => typeof v === 'number' ? v : v == null || v === '' ? NaN : Number(v);
const cleanNumberText = s => {var _s;
  if (typeof s !== 'string') s = String((_s = s) !== null && _s !== void 0 ? _s : '');
  // Keep digits and a single dot
  const cleaned = s.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');
  return cleaned.length ? cleaned : '';
};
const parseCurrency = s => {
  const c = cleanNumberText(s);
  if (!c) return NaN;
  const n = Number(c);
  return Number.isFinite(n) ? n : NaN;
};
const fmtCurrency0 = n => Number.isFinite(n) ?
n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }) :
'—';
const fmtPercent1 = n => Number.isFinite(n) ?
`${(n * 100).toLocaleString(undefined, { maximumFractionDigits: 1 })}%` :
'—';
const fmt1 = n => Number.isFinite(n) ?
n.toLocaleString(undefined, { maximumFractionDigits: 1 }) :
'—';

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
    return Number(display).toLocaleString(undefined, { maximumFractionDigits: 2 });
  })();

  return /*#__PURE__*/React.createElement("span", { className: 'mono ' + className }, out);
}

/* =========================
   Tax (approx) — SINGLE filer
   Simple estimate for effective federal rate; not advice
========================= */
function estFedTaxSingleEffective(annualIncome) {
  // Rough 2024-ish brackets & standard deduction (approx)
  const stdDeduction = 14600;
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
   Tooltip system (keeps Fitness style)
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



const InstagramSVG = () => /*#__PURE__*/
React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 24 24", className: "w-4 h-4", fill: "currentColor" }, /*#__PURE__*/
React.createElement("path", { d: "M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7zm5 3.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11zm0 2a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM18 6.2a1 1 0 1 1 0 2 1 1 0 0 1 0-2z" }));


const TikTokSVG = () => /*#__PURE__*/
React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 48 48", className: "w-4 h-4", fill: "currentColor" }, /*#__PURE__*/
React.createElement("path", { d: "M30 6c1.6 3.6 4.6 6.3 8.3 7.2v6.1c-3.2-.1-6.2-1.1-8.7-2.8v12.3c0 7.1-5.7 12.8-12.8 12.8S4 35.9 4 28.8s5.7-12.8 12.8-12.8c1.2 0 2.4.2 3.5.5v6.4c-.9-.4-1.9-.6-3-.6-3.4 0-6.3 2.8-6.3 6.3s2.8 6.3 6.3 6.3 6.3-2.8 6.3-6.3V6h6.4z" }));


const Social = () => /*#__PURE__*/
React.createElement("div", { className: "flex items-center gap-4 text-sm" }, /*#__PURE__*/
React.createElement("a", { className: "inline-flex items-center gap-1 underline", href: "https://www.instagram.com/luisitin2001", target: "_blank", rel: "noreferrer", title: "@luisitin2001 on Instagram" }, /*#__PURE__*/
React.createElement(InstagramSVG, null), " Instagram"), /*#__PURE__*/

React.createElement("span", { className: "text-slate-400" }, "\u2022"), /*#__PURE__*/
React.createElement("a", { className: "inline-flex items-center gap-1 underline", href: "https://www.tiktok.com/@luisitin2001", target: "_blank", rel: "noreferrer", title: "@luisitin2001 on TikTok" }, /*#__PURE__*/
React.createElement(TikTokSVG, null), " TikTok"));




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
    const raw = e.target.value;
    const cleaned = cleanNumberText(raw);
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
const months = yrs => yrs * 12;
const monthlyRate = apr => apr / 100 / 12;
function futureValue({ principal = 0, monthly = 0, apr = 0, years = 0 }) {
  const i = monthlyRate(apr);
  const n = months(years);
  if (n <= 0) return principal;
  if (i === 0) return principal + monthly * n;
  return principal * Math.pow(1 + i, n) + monthly * (Math.pow(1 + i, n) - 1) / i;
}
function requiredMonthly({ goal = 0, principal = 0, apr = 0, years = 0 }) {
  const i = monthlyRate(apr);
  const n = months(years);
  if (n <= 0) return NaN;
  const growth = Math.pow(1 + i, n);
  if (i === 0) return (goal - principal) / n;
  return (goal - principal * growth) * i / (growth - 1);
}
function loanPayment({ principal = 0, apr = 0, years = 0 }) {
  const i = monthlyRate(apr);
  const n = months(years);
  if (principal <= 0 || n <= 0) return { pmt: NaN, totalPaid: NaN, totalInterest: NaN };
  if (i === 0) {
    const pmt = principal / n;
    return { pmt, totalPaid: pmt * n, totalInterest: 0 };
  }
  const pmt = principal * i / (1 - Math.pow(1 + i, -n));
  const totalPaid = pmt * n;
  return { pmt, totalPaid, totalInterest: totalPaid - principal };
}

/* =========================
   Info Panel (short references)
========================= */
const FIN_INFO = [
{
  id: 'compounding',
  label: 'Compound Interest & Starting Early',
  body: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/
  React.createElement("p", { className: "mb-2" }, "Compounding grows money exponentially. Small amounts invested early can beat larger amounts invested later."), /*#__PURE__*/
  React.createElement("ul", { className: "list-disc pl-5 space-y-1" }, /*#__PURE__*/
  React.createElement("li", null, "Rule of 72: years to double \u2248 72 / annual return."), /*#__PURE__*/
  React.createElement("li", null, "Monthly contributions and time are your superpowers."))),


  sources: [{ label: 'investor.gov – Compound Interest', href: 'https://www.investor.gov/financial-tools-calculators/calculators/compound-interest-calculator' }] },

{
  id: 'fees',
  label: 'Expense Ratios & Fees',
  body: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/
  React.createElement("p", { className: "mb-2" }, "Fees compound too and can dramatically reduce ending wealth over decades."), /*#__PURE__*/
  React.createElement("ul", { className: "list-disc pl-5 space-y-1" }, /*#__PURE__*/
  React.createElement("li", null, "Favor low-cost, diversified funds for long horizons."))),


  sources: [{ label: 'bogleheads.org – Expense ratios', href: 'https://www.bogleheads.org/wiki/Expense_ratios' }] },

{
  id: 'mortgage',
  label: 'Loans & Mortgages',
  body: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/
  React.createElement("p", { className: "mb-2" }, "Amortized loans have fixed payments; most interest is front-loaded early in the schedule."), /*#__PURE__*/
  React.createElement("ul", { className: "list-disc pl-5 space-y-1" }, /*#__PURE__*/
  React.createElement("li", null, "Shorter terms \u2192 higher payment but far less total interest."), /*#__PURE__*/
  React.createElement("li", null, "Extra principal payments can save years and thousands."))),


  sources: [{ label: 'consumerfinance.gov – Mortgages', href: 'https://www.consumerfinance.gov/owning-a-home/mortgage-payment-calculator/' }] },

{
  id: 'emergency',
  label: 'Emergency Funds',
  body: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/
  React.createElement("p", { className: "mb-2" }, "Cash buffers help you avoid high-interest debt when life happens."), /*#__PURE__*/
  React.createElement("ul", { className: "list-disc pl-5 space-y-1" }, /*#__PURE__*/
  React.createElement("li", null, "Typical guidance: 3\u20136 months of expenses (more if income varies)."))),


  sources: [{ label: 'consumerfinance.gov – Savings', href: 'https://www.consumerfinance.gov/start-small-save-up/' }] }];


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

  // Fun facts
  const FUN = [
  'Rule of 72: at 8% annual growth, money doubles in ~9 years.',
  'Fees compound too — a 1% fee can erase tens of thousands over decades.',
  'Time in the market often beats timing the market.',
  'Most mortgage interest is paid early in the loan schedule.',
  'An emergency fund (3–6 months) can keep you out of high-interest debt.',
  'Small contributions started early can beat larger contributions started later.',
  'Extra principal payments can save years and thousands on a mortgage.',
  'Diversification reduces risk without giving up much return.',
  'Automating savings increases follow-through and reduces decision fatigue.',
  'Tax-advantaged accounts (401k/IRA) can accelerate compounding.',
  'High-APR debt “earns” against you; paying it is a guaranteed return.',
  'Inflation reduces purchasing power; consider real (after-inflation) returns.'];

  const [factIdx, setFactIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setFactIdx(i => (i + 1) % FUN.length), 10000);
    return () => clearInterval(id);
  }, []);
  const shuffleFact = () => setFactIdx(i => (i + 1) % FUN.length);

  /* ===== Profile state (with Simple/Advanced toggles) ===== */
  const [incMode, setIncMode] = useState('Simple'); // Income: Simple | Advanced
  const [expMode, setExpMode] = useState('Simple'); // Expenses: Simple | Advanced
  const [savMode, setSavMode] = useState('Simple'); // Savings: Simple | Advanced

  // Placeholders using rough U.S. medians (UX only)
  const medianAnnualIncome = 74000;
  const medianMonthlyIncome = Math.round(medianAnnualIncome / 12);
  const medianMonthlyExpenses = 4000;
  const medianLiquidSavings = 5300;

  // Income (Simple/Advanced) — values entered in current cadence; we convert them when cadence changes
  const [incSimple, setIncSimple] = useState(NaN);
  const [incWork, setIncWork] = useState(NaN);
  const [incHustle, setIncHustle] = useState(NaN);
  const [incTenants, setIncTenants] = useState(NaN);
  // Expenses (Simple/Advanced)
  const [expSimple, setExpSimple] = useState(NaN);
  const [expHousing, setExpHousing] = useState(NaN);
  const [expAuto, setExpAuto] = useState(NaN);
  const [expFood, setExpFood] = useState(NaN);
  const [expEntertainment, setExpEntertainment] = useState(NaN);
  const [expInsurance, setExpInsurance] = useState(NaN);
  const [expUtilities, setExpUtilities] = useState(NaN);
  const [expOther, setExpOther] = useState(NaN);
  // Savings (balances; not cadence-dependent)
  const [liquidSavings, setLiquidSavings] = useState(NaN);
  const [balEmergency, setBalEmergency] = useState(NaN);
  const [balPretax, setBalPretax] = useState(NaN);
  const [balRoth, setBalRoth] = useState(NaN);
  const [balTaxable, setBalTaxable] = useState(NaN);

  // Convert all cadence-dependent profile inputs when switching cadence
  const handleCadenceChange = next => {
    if (next === cadence) return;
    const factor = cadence === 'Monthly' && next === 'Annual' ? 12 : 1 / 12;
    const conv = v => Number.isFinite(v) ? v * factor : v;

    // Income
    setIncSimple(prev => conv(prev));
    setIncWork(prev => conv(prev));
    setIncHustle(prev => conv(prev));
    setIncTenants(prev => conv(prev));
    // Expenses
    setExpSimple(prev => conv(prev));
    setExpHousing(prev => conv(prev));
    setExpAuto(prev => conv(prev));
    setExpFood(prev => conv(prev));
    setExpEntertainment(prev => conv(prev));
    setExpInsurance(prev => conv(prev));
    setExpUtilities(prev => conv(prev));
    setExpOther(prev => conv(prev));
    // Savings balances remain unchanged

    setCadence(next);
  };

  // Convert entered values to MONTHLY totals for analysis
  const monthlyIncome = useMemo(() => {
    const primaryToMonthly = v => cadence === 'Monthly' ? v : v / 12;
    if (incMode === 'Simple') return Number.isFinite(incSimple) ? primaryToMonthly(incSimple) : NaN;
    const parts = [incWork, incHustle, incTenants].map(primaryToMonthly);
    const sum = parts.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
    return sum > 0 ? sum : NaN;
  }, [incMode, incSimple, incWork, incHustle, incTenants, cadence]);

  const monthlyExpenses = useMemo(() => {
    const primaryToMonthly = v => cadence === 'Monthly' ? v : v / 12;
    if (expMode === 'Simple') return Number.isFinite(expSimple) ? primaryToMonthly(expSimple) : NaN;
    const parts = [expHousing, expAuto, expFood, expEntertainment, expInsurance, expUtilities, expOther].map(primaryToMonthly);
    const sum = parts.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
    return sum > 0 ? sum : NaN;
  }, [expMode, expSimple, expHousing, expAuto, expFood, expEntertainment, expInsurance, expUtilities, expOther, cadence]);

  const totalSavingsBalance = useMemo(() => {
    if (savMode === 'Simple') return Number.isFinite(liquidSavings) ? liquidSavings : NaN;
    const parts = [balEmergency, balPretax, balRoth, balTaxable];
    const sum = parts.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
    return sum > 0 ? sum : NaN;
  }, [savMode, liquidSavings, balEmergency, balPretax, balRoth, balTaxable]);

  // Disposable income / savings capacity (monthly)
  const dispoMonthly = useMemo(() => {
    if (!Number.isFinite(monthlyIncome) || !Number.isFinite(monthlyExpenses)) return NaN;
    return Math.max(0, monthlyIncome - monthlyExpenses);
  }, [monthlyIncome, monthlyExpenses]);

  const savingsPercent = useMemo(() => {
    if (!Number.isFinite(monthlyIncome) || monthlyIncome <= 0 || !Number.isFinite(dispoMonthly)) return NaN;
    return dispoMonthly / monthlyIncome;
  }, [dispoMonthly, monthlyIncome]);

  // Income conversions & estimated tax (based on annualized income)
  const annualIncomeForTax = useMemo(() => {
    if (!Number.isFinite(monthlyIncome)) return NaN;
    return monthlyIncome * 12;
  }, [monthlyIncome]);
  const taxEst = useMemo(() => {
    if (!Number.isFinite(annualIncomeForTax)) return { tax: NaN, effective: NaN };
    return estFedTaxSingleEffective(annualIncomeForTax);
  }, [annualIncomeForTax]);

  /* ===== Savings & Growth ===== */
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

  // Mortgage mini-card
  const [loanP, setLoanP] = useState(250000);
  const [loanAPR, setLoanAPR] = useState(4);
  const [loanYears, setLoanYears] = useState(30);
  const loan = useMemo(() => loanPayment({
    principal: Number.isFinite(loanP) ? loanP : 0,
    apr: Number.isFinite(loanAPR) ? loanAPR : 0,
    years: Number.isFinite(loanYears) ? loanYears : 0 }),
  [loanP, loanAPR, loanYears]);

  /* ===== Optimize Plan — strategies ===== */
  const [strategy, setStrategy] = useState('FIRE'); // 'FIRE' | 'Maximize Retirement' | 'Minimize Expenses'
  // Optional debt inputs (for Minimize Expenses)
  const [optDebtAPR, setOptDebtAPR] = useState(NaN);
  const [optDebtBal, setOptDebtBal] = useState(NaN);

  const rec = useMemo(() => {
    const bullets = [];
    const targets = [];
    let badge = 'PLAN';

    const mi = monthlyIncome;
    const me = monthlyExpenses;

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
      bullets.push('Consider target-date or 80/20 stock/bond allocation (age-dependent).');
      bullets.push('Keep an emergency fund (3–6 months) to avoid high-interest debt.');
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

  /* ===== UI helpers ===== */
  const SecondaryLine = ({ primary, cadence }) => {
    if (!Number.isFinite(primary)) return null;
    if (cadence === 'Monthly') {
      const annual = primary * 12;
      return /*#__PURE__*/React.createElement("div", { className: "text-[11px] text-slate-500 mt-1" }, "\u2248 ", fmtCurrency0(annual), " / yr");
    } else {
      const monthly = primary / 12;
      return /*#__PURE__*/React.createElement("div", { className: "text-[11px] text-slate-500 mt-1" }, "\u2248 ", fmtCurrency0(monthly), " / mo");
    }
  };

  const SmallTaxLine = () => {
    if (!Number.isFinite(annualIncomeForTax)) return null;
    return /*#__PURE__*/(
      React.createElement("div", { className: "text-[11px] text-slate-500 mt-1" }, "Est. federal effective tax (single): ",
      fmtPercent1(taxEst.effective)));


  };

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

    React.createElement("div", { className: "grid grid-cols-4 gap-2" },
    ['Profile', 'Savings & Growth', 'Optimize Plan', 'Info'].map((v) => /*#__PURE__*/
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

    React.createElement(SecondaryLine, { primary: incSimple, cadence: cadence }), /*#__PURE__*/
    React.createElement("div", { className: "text-[11px] text-slate-500 mt-1" }, "Est. federal effective tax (single): ",
    fmtPercent1(estFedTaxSingleEffective(Number.isFinite(incSimple) ? cadence === 'Monthly' ? incSimple * 12 : incSimple : NaN).effective)))) : /*#__PURE__*/




    React.createElement("div", { className: "grid sm:grid-cols-3 gap-4" }, /*#__PURE__*/
    React.createElement("div", null, /*#__PURE__*/
    React.createElement("label", { className: "block text-sm font-medium" }, "Work (",
    cadence, ") ", /*#__PURE__*/React.createElement(Info, { tip: "Salary/wages before tax." })), /*#__PURE__*/

    React.createElement(CurrencyInput, {
      value: incWork,
      onChange: setIncWork,
      placeholder: cadence === 'Monthly' ? fmtCurrency0(medianMonthlyIncome * 0.8) : fmtCurrency0(medianAnnualIncome * 0.8) }), /*#__PURE__*/

    React.createElement(SecondaryLine, { primary: incWork, cadence: cadence })), /*#__PURE__*/

    React.createElement("div", null, /*#__PURE__*/
    React.createElement("label", { className: "block text-sm font-medium" }, "Hustle (",
    cadence, ") ", /*#__PURE__*/React.createElement(Info, { tip: "Side gigs, freelance, small business income." })), /*#__PURE__*/

    React.createElement(CurrencyInput, {
      value: incHustle,
      onChange: setIncHustle,
      placeholder: cadence === 'Monthly' ? fmtCurrency0(300) : fmtCurrency0(3600) }), /*#__PURE__*/

    React.createElement(SecondaryLine, { primary: incHustle, cadence: cadence })), /*#__PURE__*/

    React.createElement("div", null, /*#__PURE__*/
    React.createElement("label", { className: "block text-sm font-medium" }, "Tenants (",
    cadence, ") ", /*#__PURE__*/React.createElement(Info, { tip: "Rental income (net of vacancy/maintenance if possible)." })), /*#__PURE__*/

    React.createElement(CurrencyInput, {
      value: incTenants,
      onChange: setIncTenants,
      placeholder: cadence === 'Monthly' ? fmtCurrency0(1200) : fmtCurrency0(14400) }), /*#__PURE__*/

    React.createElement(SecondaryLine, { primary: incTenants, cadence: cadence })), /*#__PURE__*/

    React.createElement("div", { className: "sm:col-span-3" }, /*#__PURE__*/
    React.createElement("div", { className: "text-[11px] text-slate-500" }, "Sum auto-converted to monthly for analysis.")))), /*#__PURE__*/








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
      placeholder: cadence === 'Monthly' ? fmtCurrency0(medianMonthlyExpenses) : fmtCurrency0(medianMonthlyExpenses * 12) }), /*#__PURE__*/

    React.createElement(SecondaryLine, { primary: expSimple, cadence: cadence }))) : /*#__PURE__*/



    React.createElement("div", { className: "grid sm:grid-cols-3 gap-4" }, /*#__PURE__*/
    React.createElement("div", null, /*#__PURE__*/
    React.createElement("label", { className: "block text-sm font-medium" }, "Housing (", cadence, ")"), /*#__PURE__*/
    React.createElement(CurrencyInput, { value: expHousing, onChange: setExpHousing, placeholder: cadence === 'Monthly' ? fmtCurrency0(1800) : fmtCurrency0(21600) }), /*#__PURE__*/
    React.createElement(SecondaryLine, { primary: expHousing, cadence: cadence })), /*#__PURE__*/

    React.createElement("div", null, /*#__PURE__*/
    React.createElement("label", { className: "block text-sm font-medium" }, "Auto/Transport (", cadence, ")"), /*#__PURE__*/
    React.createElement(CurrencyInput, { value: expAuto, onChange: setExpAuto, placeholder: cadence === 'Monthly' ? fmtCurrency0(600) : fmtCurrency0(7200) }), /*#__PURE__*/
    React.createElement(SecondaryLine, { primary: expAuto, cadence: cadence })), /*#__PURE__*/

    React.createElement("div", null, /*#__PURE__*/
    React.createElement("label", { className: "block text-sm font-medium" }, "Food (", cadence, ")"), /*#__PURE__*/
    React.createElement(CurrencyInput, { value: expFood, onChange: setExpFood, placeholder: cadence === 'Monthly' ? fmtCurrency0(600) : fmtCurrency0(7200) }), /*#__PURE__*/
    React.createElement(SecondaryLine, { primary: expFood, cadence: cadence })), /*#__PURE__*/

    React.createElement("div", null, /*#__PURE__*/
    React.createElement("label", { className: "block text-sm font-medium" }, "Entertainment (", cadence, ")"), /*#__PURE__*/
    React.createElement(CurrencyInput, { value: expEntertainment, onChange: setExpEntertainment, placeholder: cadence === 'Monthly' ? fmtCurrency0(250) : fmtCurrency0(3000) }), /*#__PURE__*/
    React.createElement(SecondaryLine, { primary: expEntertainment, cadence: cadence })), /*#__PURE__*/

    React.createElement("div", null, /*#__PURE__*/
    React.createElement("label", { className: "block text-sm font-medium" }, "Insurance (", cadence, ")"), /*#__PURE__*/
    React.createElement(CurrencyInput, { value: expInsurance, onChange: setExpInsurance, placeholder: cadence === 'Monthly' ? fmtCurrency0(400) : fmtCurrency0(4800) }), /*#__PURE__*/
    React.createElement(SecondaryLine, { primary: expInsurance, cadence: cadence })), /*#__PURE__*/

    React.createElement("div", null, /*#__PURE__*/
    React.createElement("label", { className: "block text-sm font-medium" }, "Utilities (", cadence, ")"), /*#__PURE__*/
    React.createElement(CurrencyInput, { value: expUtilities, onChange: setExpUtilities, placeholder: cadence === 'Monthly' ? fmtCurrency0(300) : fmtCurrency0(3600) }), /*#__PURE__*/
    React.createElement(SecondaryLine, { primary: expUtilities, cadence: cadence })), /*#__PURE__*/

    React.createElement("div", { className: "sm:col-span-3" }, /*#__PURE__*/
    React.createElement("label", { className: "block text-sm font-medium" }, "Other (", cadence, ")"), /*#__PURE__*/
    React.createElement(CurrencyInput, { value: expOther, onChange: setExpOther, placeholder: cadence === 'Monthly' ? fmtCurrency0(200) : fmtCurrency0(2400) }), /*#__PURE__*/
    React.createElement(SecondaryLine, { primary: expOther, cadence: cadence })), /*#__PURE__*/

    React.createElement("div", { className: "sm:col-span-3 text-[11px] text-slate-500" }, "Summed & auto-converted to monthly for analysis."))), /*#__PURE__*/







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
    React.createElement(CurrencyInput, { value: balTaxable, onChange: setBalTaxable, placeholder: fmtCurrency0(8000) })), /*#__PURE__*/

    React.createElement("div", { className: "sm:col-span-2 text-[11px] text-slate-500" }, "Totals shown below; balances are not auto-tax adjusted."))), /*#__PURE__*/







    React.createElement(Section, { title: "Financial Health Snapshot", right: /*#__PURE__*/React.createElement("span", { className: "text-xs text-slate-500" }, "Monthly analysis") }, /*#__PURE__*/
    React.createElement("div", { className: "grid md:grid-cols-2 gap-4" }, /*#__PURE__*/
    React.createElement("div", { className: "p-3 rounded-xl border bg-white/60" }, /*#__PURE__*/
    React.createElement("div", { className: "font-medium mb-1 flex items-center" }, "Disposable income / savings capacity", /*#__PURE__*/

    React.createElement(Info, { tip: "Disposable income (monthly) = Monthly income − Monthly expenses.\nThis is the amount you can direct to goals (emergency fund, investing, debt prepayment)." })), /*#__PURE__*/

    React.createElement("div", { className: "text-sm" }, /*#__PURE__*/
    React.createElement("span", { className: "font-semibold" }, /*#__PURE__*/React.createElement(SmoothNumber, { value: dispoMonthly, format: "usd0" })), " per month"), /*#__PURE__*/

    React.createElement("p", { className: "text-xs text-slate-500 mt-1" }, "That\u2019s about ",
    fmtPercent1(savingsPercent), " of income.")), /*#__PURE__*/



    React.createElement("div", { className: "p-3 rounded-xl border bg-white/60" }, /*#__PURE__*/
    React.createElement("div", { className: "font-medium mb-1 flex items-center" }, "Emergency Fund", /*#__PURE__*/

    React.createElement(Info, { tip: "Months of expenses your savings can cover.\n3–6 months is a common guideline; more if income varies." })), /*#__PURE__*/

    React.createElement("div", { className: "text-sm" }, "~ ", /*#__PURE__*/
    React.createElement("span", { className: "font-semibold" }, /*#__PURE__*/React.createElement(SmoothNumber, { value: totalSavingsBalance / (Number.isFinite(monthlyExpenses) && monthlyExpenses > 0 ? monthlyExpenses : NaN), format: "one" })), " months"), /*#__PURE__*/

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



    React.createElement("div", { className: "text-xs text-slate-600" }, "Notes: Educational content, not individualized advice. Adjust assumptions to your situation."))))),









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