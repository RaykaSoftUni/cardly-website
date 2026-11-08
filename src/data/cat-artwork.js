// Original vector illustrations. No user input or external images enter the art.
export const catMotion = `<style>
@media (prefers-reduced-motion: no-preference) {
 .cat-groove { transform-box:fill-box; transform-origin:50% 100%; animation:cat-groove 1.4s ease-in-out 3; }
 .cat-tail { transform-box:fill-box; transform-origin:0% 90%; animation:cat-tail 1.4s ease-in-out 3; }
 .cat-note { animation:cat-note 1.4s ease-in-out 3; }
 .cat-sleep { transform-box:fill-box; transform-origin:50% 100%; animation:cat-sleep 2.1s ease-in-out 2; }
 .cat-candle { transform-box:fill-box; transform-origin:50% 100%; animation:cat-candle 1.05s ease-in-out 4; }
 @keyframes cat-groove { 0%,100% { transform:rotate(0deg); } 30% { transform:rotate(-5deg); } 70% { transform:rotate(5deg); } }
 @keyframes cat-tail { 0%,100% { transform:rotate(0deg); } 50% { transform:rotate(-12deg); } }
 @keyframes cat-note { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-12px); } }
 @keyframes cat-sleep { 0%,100% { transform:scale(1); } 50% { transform:scale(1.025,1.035); } }
 @keyframes cat-candle { 0%,100% { transform:rotate(-5deg) scale(1); } 50% { transform:rotate(7deg) scale(.92,1.08); } }
}
</style>`;

export function discoCat() {
 return `<defs><pattern id="disco-tiles" x="0" y="0" width="48" height="36" patternUnits="userSpaceOnUse"><rect width="24" height="18" fill="#d9ccef"/><rect x="24" y="18" width="24" height="18" fill="#d9ccef"/></pattern></defs>
 <rect x="76" y="212" width="448" height="308" rx="144" fill="#f8b599"/>
 <path d="M300 208v-35" stroke="#554075" stroke-width="3"/>
 <circle cx="300" cy="207" r="24" fill="#fff6d5" stroke="#554075" stroke-width="2"/>
 <path d="M278 201h44M278 212h44M300 183v48M289 187q-8 20 0 40M311 187q8 20 0 40" stroke="#bca9d4" fill="none" stroke-width="2"/>
 <g fill="#554075" class="cat-note"><path d="M112 286v-32l24-5v29l-6 2v-21l-12 3v22z"/><ellipse cx="111" cy="285" rx="9" ry="6"/><ellipse cx="130" cy="279" rx="9" ry="6"/></g>
 <g fill="#554075" class="cat-note"><path d="M472 302v-33l17 5v7l-11-3v22z"/><ellipse cx="471" cy="302" rx="9" ry="6"/></g>
 <path d="M84 468h432v52H84z" fill="url(#disco-tiles)"/>
 <ellipse cx="300" cy="501" rx="141" ry="12" fill="#c7b5df"/>
 <g class="cat-groove">
 <path class="cat-tail" d="M365 422c78 16 84-53 51-59-22-4-31 20-11 27" fill="none" stroke="#30303d" stroke-width="24" stroke-linecap="round"/>
 <path d="M222 402q2-68 78-70 76 2 78 70v65H222z" fill="#30303d"/>
 <path d="M269 373q31-14 62 0l14 72h-90z" fill="#fff6d5"/>
 <path d="M217 287l-4-65 62 34q25-8 50 0l62-34-4 65q18 29 0 66-19 36-83 36t-83-36q-18-37 0-66" fill="#30303d"/>
 <path d="M226 240l31 23-28 13zM374 240l-31 23 28 13z" fill="#f39fa7"/>
 <path d="M221 289c-5-91 164-91 158 0" fill="none" stroke="#8fc9b7" stroke-width="15" stroke-linecap="round"/>
 <rect x="207" y="282" width="21" height="49" rx="10" fill="#8fc9b7"/><rect x="372" y="282" width="21" height="49" rx="10" fill="#8fc9b7"/>
 <ellipse cx="266" cy="309" rx="20" ry="24" fill="#fff6d5"/><ellipse cx="334" cy="309" rx="20" ry="24" fill="#fff6d5"/>
 <ellipse cx="272" cy="310" rx="6" ry="13" fill="#30303d"/><ellipse cx="328" cy="310" rx="6" ry="13" fill="#30303d"/>
 <path d="M291 333q9-7 18 0l-9 8z" fill="#f39fa7"/><path d="M300 341q-7 13-16 3m16-3q7 13 16 3" fill="none" stroke="#fff6d5" stroke-width="3" stroke-linecap="round"/>
 <path d="M243 336l-29-6m29 15-29 4m143-13 29-6m-29 15 29 4" stroke="#fff6d5" stroke-width="2" stroke-linecap="round"/>
 </g>
 <rect x="166" y="420" width="268" height="70" rx="16" fill="#90cbb9" stroke="#30303d" stroke-width="3"/>
 <ellipse cx="247" cy="455" rx="43" ry="25" fill="#30303d"/><ellipse cx="247" cy="455" rx="15" ry="9" fill="#f8b599"/>
 <ellipse cx="353" cy="455" rx="43" ry="25" fill="#30303d"/><ellipse cx="353" cy="455" rx="15" ry="9" fill="#e9e1ff"/>
 <path d="M278 432l-11 18h-13M383 432l-11 18h-12" fill="none" stroke="#fff6d5" stroke-width="4" stroke-linecap="round"/>
 <path d="M299 439v31m-8-15h16" stroke="#30303d" stroke-width="4" stroke-linecap="round"/>
 <ellipse cx="231" cy="421" rx="20" ry="10" fill="#30303d"/><ellipse cx="369" cy="421" rx="20" ry="10" fill="#30303d"/>
 <path d="M135 348l4 12 13 3-13 5-4 12-4-12-13-5 13-3zM455 390l3 9 10 3-10 4-3 9-3-9-10-4 10-3z" fill="#fff6d5"/>
 <circle cx="120" cy="421" r="4" fill="#554075"/><circle cx="466" cy="240" r="4" fill="#554075"/>`;
}

const daisy = (x,y) => `<g transform="translate(${x} ${y})"><g fill="#fff9ec">${[0,60,120,180,240,300].map(a=>`<ellipse cx="0" cy="-12" rx="5" ry="9" transform="rotate(${a})"/>`).join('')}</g><circle r="6" fill="#eeb44f"/></g>`;
export function catnapCake() {
 return `<defs><pattern id="cat-check" width="32" height="32" patternUnits="userSpaceOnUse"><rect width="32" height="32" fill="#fff4e3"/><path d="M0 8h32M0 24h32M8 0v32M24 0v32" stroke="#edc4aa" stroke-width="8" opacity=".65"/></pattern></defs>
 <rect x="16" y="16" width="568" height="768" rx="28" fill="url(#cat-check)"/>
 <rect x="41" y="41" width="518" height="718" rx="20" fill="#fff9ec"/>
 <ellipse cx="300" cy="366" rx="199" ry="151" fill="#e3ede0"/>
 <path d="M103 404q-22-54 5-91m377 93q29-54 1-91" fill="none" stroke="#6e987a" stroke-width="3"/>
 <path d="M104 365q-33-7-21-29 27 3 21 29m-1 17q29-8 25-29-27-1-25 29m384-17q33-7 21-29-27 3-21 29m1 17q-29-8-25-29 27-1 25 29" fill="#a4bea1"/>
 ${daisy(107,308)}${daisy(487,308)}${daisy(468,446)}${daisy(132,453)}
 <ellipse cx="300" cy="504" rx="150" ry="14" fill="#c3d7c6"/>
 <path d="M173 432h254v54q-127 33-254 0z" fill="#6a9f91"/>
 <ellipse cx="300" cy="432" rx="127" ry="27" fill="#eebdb3"/>
 <path d="M174 429c12 12 18-1 29 5s9 25 22 23 10-22 23-20 9 17 22 17 13-20 26-18 7 28 23 27 10-26 23-27 12 18 25 17 8-20 22-19 21 9 37-5" fill="#eebdb3" stroke="#eebdb3" stroke-width="9" stroke-linecap="round"/>
 <path d="M207 470h186" stroke="#c2ddc6" stroke-width="3" stroke-linecap="round" stroke-dasharray="2 15"/>
 <path d="M159 494q141 38 282 0" fill="none" stroke="#355e51" stroke-width="4" stroke-linecap="round"/>
 <g class="cat-sleep">
 <ellipse cx="316" cy="367" rx="83" ry="51" fill="#e6a26e"/>
 <path d="M343 333q-8 28 10 42m-39-50q-9 22 3 37m-38-30q-8 16 2 30" fill="none" stroke="#be7951" stroke-width="9" stroke-linecap="round"/>
 <path class="cat-tail" d="M348 398q96 6 83-47-7-28-30-9" fill="none" stroke="#e6a26e" stroke-width="23" stroke-linecap="round"/>
 <path d="M215 336l-4-43 39 23q19-3 36 5l39-13-14 43q9 29-16 47-24 17-57 4t-23-66" fill="#efbb8b"/>
 <path d="M220 308l17 15-16 9m92-11-21 9 15 9" fill="#d99380"/>
 <path d="M232 354q9 12 19 1m22 2q9 13 19 3" fill="none" stroke="#355e51" stroke-width="4" stroke-linecap="round"/>
 <path d="M254 370l8-2 4 7-7 5z" fill="#be7951"/><path d="M260 380q-7 8-13 0m13 0q4 8 11 3" fill="none" stroke="#355e51" stroke-width="2" stroke-linecap="round"/>
 <path d="M230 375l-23-3m22 10-24 5m88-5 22 4m-23 4 20 10" stroke="#355e51" stroke-width="2" stroke-linecap="round"/>
 <ellipse cx="258" cy="408" rx="23" ry="10" fill="#efbb8b"/><ellipse cx="299" cy="410" rx="21" ry="10" fill="#efbb8b"/>
 </g>
 <rect x="183" y="367" width="10" height="56" rx="4" fill="#f3d076"/><path d="M184 383l8-7m-8 23 8-7m-8 23 8-7" stroke="#fff9ec" stroke-width="3"/>
 <path class="cat-candle" d="M188 365q-15-14 0-29 14 15 0 29" fill="#d6883a"/>
 <g fill="#355e51" class="cat-note"><path d="M367 280h18l-18 18h18" fill="none" stroke="#355e51" stroke-width="3" stroke-linejoin="round"/><path d="M397 257h12l-12 13h12" fill="none" stroke="#355e51" stroke-width="2" stroke-linejoin="round"/></g>`;
}
