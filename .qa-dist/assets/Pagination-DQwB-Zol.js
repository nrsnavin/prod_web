import{c as o,j as n,x as c}from"./index-CkE6j5sK.js";import{C as m}from"./chevron-right-DO1mHf8i.js";/**
 * @license lucide-react v0.446.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const x=o("ChevronLeft",[["path",{d:"m15 18-6-6 6-6",key:"1wnfg3"}]]);function h({page:s,totalPages:i,onChange:a,total:e,pageSize:r=20}){if(i<=1&&!e)return null;const l=(s-1)*r+1,t=e!=null?Math.min(s*r,e):s*r;return n.jsxs("div",{className:"flex items-center justify-end gap-3 px-4 py-3",children:[n.jsx("span",{className:"text-sm text-ink-400 tabular-nums",children:e!=null?`Showing ${l}–${t} of ${e.toLocaleString("en-IN")}`:`Page ${s} of ${i}`}),n.jsxs("div",{className:"flex gap-1",children:[n.jsx(c,{variant:"secondary",size:"sm",disabled:s<=1,onClick:()=>a(s-1),"aria-label":"Previous page",children:n.jsx(x,{className:"h-4 w-4"})}),n.jsx(c,{variant:"secondary",size:"sm",disabled:s>=i,onClick:()=>a(s+1),"aria-label":"Next page",children:n.jsx(m,{className:"h-4 w-4"})})]})]})}export{h as P};
