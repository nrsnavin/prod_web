import{c as n,J as o,r as c,j as e}from"./index-CkE6j5sK.js";/**
 * @license lucide-react v0.446.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const i=n("RotateCw",[["path",{d:"M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8",key:"1p45f6"}],["path",{d:"M21 3v5h-5",key:"1q7to0"}]]);function l({message:s}){const a=o(),[r,t]=c.useState(!1);return e.jsxs("div",{className:"mb-4 flex items-center gap-3 rounded-lg bg-status-dangerBg px-4 py-3 text-sm text-status-danger",children:[e.jsx("span",{className:"flex-1",children:s}),e.jsxs("button",{onClick:async()=>{t(!0),await a.refetchQueries({type:"active"}),t(!1)},className:"inline-flex items-center gap-1.5 rounded-lg border border-status-danger/40 px-2.5 py-1 font-medium hover:bg-status-danger hover:text-white transition-colors",children:[e.jsx(i,{className:r?"h-3.5 w-3.5 animate-spin":"h-3.5 w-3.5"}),"Retry"]})]})}export{l as E};
