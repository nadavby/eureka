// Writes the demo item illustrations (drawn for Eureka, no third-party images) into demo/images.
//   node demo/make-images.cjs
const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "images");
fs.mkdirSync(dir, { recursive: true });

const svg = (comment, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">\n  <!-- ${comment} -->\n${body}\n</svg>\n`;

const images = {
  "keys.svg": svg(
    "two keys (silver and brass) on a red carabiner with a blue star tag, on grey pavement",
    `  <rect width="400" height="300" fill="#9aa1a8"/>
  <g fill="#8b9299" opacity=".6"><rect x="0" y="0" width="130" height="100"/><rect x="135" y="105" width="130" height="95"/><rect x="270" y="0" width="130" height="100"/><rect x="0" y="205" width="130" height="95"/><rect x="270" y="205" width="130" height="95"/></g>
  <ellipse cx="205" cy="228" rx="110" ry="14" fill="#000" opacity=".18"/>
  <path d="M120 110 a38 38 0 1 1 0 2" fill="none" stroke="#d03b2f" stroke-width="12" stroke-linecap="round"/>
  <rect x="152" y="96" width="14" height="30" rx="4" fill="#9b2a20"/>
  <g transform="rotate(18 200 160)">
    <circle cx="190" cy="140" r="24" fill="#c9ced4" stroke="#8d949b" stroke-width="3"/><circle cx="190" cy="140" r="7" fill="#9aa1a8"/>
    <path d="M212 136 h110 v14 h-12 v12 h-10 v-12 h-10 v16 h-10 v-16 h-68z" fill="#c9ced4" stroke="#8d949b" stroke-width="3"/>
  </g>
  <g transform="rotate(-24 180 175)">
    <circle cx="176" cy="168" r="20" fill="#d8c27a" stroke="#a88f3f" stroke-width="3"/><circle cx="176" cy="168" r="6" fill="#9aa1a8"/>
    <path d="M194 164 h86 v12 h-10 v10 h-9 v-10 h-9 v12 h-9 v-12 h-49z" fill="#d8c27a" stroke="#a88f3f" stroke-width="3"/>
  </g>
  <path d="M96 150 l10 22 l24 3 l-18 16 l5 24 l-21 -12 l-21 12 l5 -24 l-18 -16 l24 -3z" fill="#2f6fdb" stroke="#1d4fa8" stroke-width="2"/>`
  ),
  "phone.svg": svg(
    "black phone with a cracked top-right corner and a yellow smiley sticker, on a cafe table",
    `  <rect width="400" height="300" fill="#e9dfcf"/>
  <circle cx="330" cy="70" r="46" fill="#f6f1e8" stroke="#d7c8b1" stroke-width="4"/>
  <ellipse cx="200" cy="248" rx="80" ry="12" fill="#000" opacity=".18"/>
  <g transform="rotate(-12 200 150)">
    <rect x="140" y="40" width="120" height="210" rx="18" fill="#1f2328"/>
    <rect x="150" y="52" width="100" height="186" rx="10" fill="#2c333b"/>
    <path d="M236 54 l-18 22 l10 6 l-14 18 M236 54 l-6 30 l12 4" fill="none" stroke="#c4c9cf" stroke-width="2"/>
    <circle cx="178" cy="196" r="17" fill="#f2c94c"/><circle cx="172" cy="192" r="2.5" fill="#1f2328"/><circle cx="184" cy="192" r="2.5" fill="#1f2328"/>
    <path d="M170 201 q8 7 16 0" fill="none" stroke="#1f2328" stroke-width="2.5" stroke-linecap="round"/>
  </g>`
  ),
  "backpack.svg": svg(
    "navy backpack with an orange zipper pull and a white mountain patch, under a lecture-hall seat",
    `  <rect width="400" height="300" fill="#c9b79c"/>
  <rect x="0" y="0" width="400" height="70" fill="#8a3b2c"/>
  <ellipse cx="200" cy="262" rx="110" ry="14" fill="#000" opacity=".2"/>
  <path d="M150 70 q50 -40 100 0" fill="none" stroke="#1d2b53" stroke-width="12"/>
  <rect x="120" y="70" width="160" height="190" rx="40" fill="#1d2b53"/>
  <rect x="140" y="160" width="120" height="80" rx="20" fill="#26386b"/>
  <line x1="150" y1="170" x2="250" y2="170" stroke="#0f1830" stroke-width="3"/>
  <rect x="236" y="166" width="10" height="22" rx="3" fill="#ec7a23"/>
  <rect x="168" y="98" width="64" height="44" rx="6" fill="#f7f7f5"/>
  <path d="M176 134 l14 -22 l10 12 l8 -8 l16 18z" fill="#1d2b53"/>`
  ),
  "glasses.svg": svg(
    "tortoiseshell sunglasses with a scratched left lens, on beach sand",
    `  <rect width="400" height="300" fill="#ecd7a8"/>
  <g fill="#dcc28c" opacity=".7"><circle cx="60" cy="60" r="3"/><circle cx="320" cy="40" r="2"/><circle cx="90" cy="240" r="3"/><circle cx="350" cy="230" r="2.5"/><circle cx="210" cy="260" r="2"/></g>
  <ellipse cx="200" cy="200" rx="140" ry="16" fill="#000" opacity=".15"/>
  <g stroke="#6b3d1f" stroke-width="10" fill="#2a2a2a">
    <rect x="80" y="110" width="105" height="80" rx="30"/><rect x="215" y="110" width="105" height="80" rx="30"/>
  </g>
  <path d="M185 130 q15 -14 30 0" fill="none" stroke="#6b3d1f" stroke-width="10"/>
  <g fill="#a0612f" opacity=".7"><circle cx="90" cy="118" r="5"/><circle cx="170" cy="182" r="4"/><circle cx="300" cy="120" r="5"/><circle cx="228" cy="180" r="4"/></g>
  <path d="M100 150 l40 -24 M110 164 l30 -14" stroke="#c4c9cf" stroke-width="2" opacity=".9"/>`
  ),
  "headphones.svg": svg(
    "white over-ear headphones with a purple sticker on the right cup, on a train seat",
    `  <rect width="400" height="300" fill="#3a6b8f"/>
  <g stroke="#335f80" stroke-width="6" opacity=".7"><line x1="0" y1="60" x2="400" y2="60"/><line x1="0" y1="120" x2="400" y2="120"/><line x1="0" y1="180" x2="400" y2="180"/><line x1="0" y1="240" x2="400" y2="240"/></g>
  <ellipse cx="200" cy="250" rx="120" ry="14" fill="#000" opacity=".22"/>
  <path d="M110 190 q0 -130 90 -130 q90 0 90 130" fill="none" stroke="#f7f7f5" stroke-width="18"/>
  <rect x="80" y="170" width="60" height="80" rx="26" fill="#f7f7f5"/><rect x="260" y="170" width="60" height="80" rx="26" fill="#f7f7f5"/>
  <rect x="94" y="184" width="32" height="52" rx="14" fill="#d9dde2"/><rect x="274" y="184" width="32" height="52" rx="14" fill="#d9dde2"/>
  <circle cx="290" cy="210" r="11" fill="#7d4cc9"/><path d="M285 210 l4 4 l7 -9" fill="none" stroke="#fff" stroke-width="2.5"/>`
  ),
  "umbrella.svg": svg(
    "green folded umbrella with a wooden J handle and a white strap, leaning on a bus-stop wall",
    `  <rect width="400" height="300" fill="#b9c4cc"/>
  <rect x="0" y="230" width="400" height="70" fill="#8d9aa3"/>
  <ellipse cx="210" cy="252" rx="60" ry="8" fill="#000" opacity=".2"/>
  <g transform="rotate(-16 200 150)">
    <path d="M190 40 l20 0 l14 160 l-48 0z" fill="#2f9e5a"/>
    <path d="M196 60 l4 140 M206 60 l8 140" stroke="#237a45" stroke-width="3"/>
    <rect x="186" y="120" width="40" height="10" rx="3" fill="#f7f7f5"/>
    <line x1="200" y1="200" x2="200" y2="236" stroke="#5b5f63" stroke-width="6"/>
    <path d="M200 236 q0 30 26 30 q20 0 20 -20" fill="none" stroke="#8a5534" stroke-width="12" stroke-linecap="round"/>
  </g>`
  ),
  "watch.svg": svg(
    "gold watch with a green dial and a brown leather strap, engraved M and R, on a gym bench",
    `  <rect width="400" height="300" fill="#2b2f36"/>
  <rect x="0" y="120" width="400" height="90" fill="#3a3f48"/>
  <ellipse cx="200" cy="215" rx="140" ry="12" fill="#000" opacity=".3"/>
  <rect x="40" y="150" width="320" height="30" rx="12" fill="#7b4a2c"/>
  <g fill="#5a341d"><circle cx="80" cy="165" r="3"/><circle cx="100" cy="165" r="3"/><circle cx="120" cy="165" r="3"/></g>
  <circle cx="200" cy="165" r="56" fill="#d4af37"/><circle cx="200" cy="165" r="44" fill="#1f5e43"/>
  <line x1="200" y1="165" x2="200" y2="134" stroke="#f7f7f5" stroke-width="4" stroke-linecap="round"/>
  <line x1="200" y1="165" x2="222" y2="176" stroke="#f7f7f5" stroke-width="3" stroke-linecap="round"/>
  <text x="200" y="250" font-family="Georgia, serif" font-size="20" fill="#d4af37" text-anchor="middle" font-style="italic">M &amp; R</text>`
  ),
  "dog.svg": svg(
    "small beige dog with one brown ear and a red collar with a bone-shaped tag, in a park",
    `  <rect width="400" height="300" fill="#a9cf8b"/>
  <rect x="0" y="0" width="400" height="110" fill="#cfe6f2"/>
  <ellipse cx="200" cy="262" rx="100" ry="12" fill="#000" opacity=".15"/>
  <ellipse cx="200" cy="215" rx="80" ry="45" fill="#e3d3b5"/>
  <rect x="140" y="230" width="18" height="34" rx="8" fill="#e3d3b5"/><rect x="240" y="230" width="18" height="34" rx="8" fill="#e3d3b5"/>
  <circle cx="200" cy="140" r="50" fill="#e3d3b5"/>
  <path d="M154 120 q-20 30 0 54 q10 -20 6 -50z" fill="#7b4a2c"/>
  <path d="M246 120 q20 30 0 54 q-10 -20 -6 -50z" fill="#e3d3b5" stroke="#d1bf9b" stroke-width="2"/>
  <circle cx="182" cy="136" r="5" fill="#1f2328"/><circle cx="218" cy="136" r="5" fill="#1f2328"/>
  <ellipse cx="200" cy="156" rx="9" ry="6" fill="#1f2328"/>
  <rect x="166" y="180" width="68" height="10" rx="5" fill="#d03b2f"/>
  <path d="M192 192 h16 a4 4 0 1 1 0 8 h-16 a4 4 0 1 1 0 -8z" fill="#c4c9cf"/>`
  ),
  "bicycle.svg": svg(
    "light blue city bike with a wicker basket and a bell, rear fender dented, by a fence",
    `  <rect width="400" height="300" fill="#e7e2d6"/>
  <g stroke="#b7ae9b" stroke-width="5"><line x1="20" y1="40" x2="20" y2="210"/><line x1="80" y1="40" x2="80" y2="210"/><line x1="140" y1="40" x2="140" y2="210"/><line x1="320" y1="40" x2="320" y2="210"/><line x1="380" y1="40" x2="380" y2="210"/><line x1="0" y1="70" x2="400" y2="70"/></g>
  <ellipse cx="200" cy="262" rx="160" ry="12" fill="#000" opacity=".15"/>
  <g fill="none" stroke="#2c333b" stroke-width="7"><circle cx="110" cy="210" r="48"/><circle cx="290" cy="210" r="48"/></g>
  <g fill="none" stroke="#7fb3d5" stroke-width="9" stroke-linecap="round" stroke-linejoin="round">
    <path d="M110 210 l60 -80 h90 l30 80 M170 130 l40 80 l50 -80 M210 210 l-100 0"/>
    <path d="M260 130 l-6 -26 h26"/>
  </g>
  <path d="M60 210 q50 -64 100 -18" fill="none" stroke="#7fb3d5" stroke-width="6"/>
  <path d="M90 168 l10 6" stroke="#5d6a72" stroke-width="5"/>
  <rect x="270" y="80" width="60" height="34" rx="6" fill="#c99a5a"/>
  <g stroke="#a87b40" stroke-width="2"><line x1="280" y1="80" x2="280" y2="114"/><line x1="294" y1="80" x2="294" y2="114"/><line x1="308" y1="80" x2="308" y2="114"/><line x1="322" y1="80" x2="322" y2="114"/></g>
  <circle cx="246" cy="104" r="7" fill="#c4c9cf"/>
  <rect x="160" y="112" width="34" height="10" rx="5" fill="#7b4a2c"/>`
  ),
};

for (const [name, content] of Object.entries(images)) fs.writeFileSync(path.join(dir, name), content);
for (const name of ["example-lost.svg", "example-found.svg"]) {
  const target = name === "example-lost.svg" ? "wallet-lost.svg" : "wallet-found.svg";
  fs.copyFileSync(path.join(__dirname, "../../frontend/src/features/landing", name), path.join(dir, target));
}
console.log(`wrote ${Object.keys(images).length + 2} illustrations to ${dir}`);
