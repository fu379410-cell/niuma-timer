# ImageGen 设计记录

原型与透明角色均使用内置 image_gen 工具生成。原型数据仅用于展示视觉方向，程序中的数字由计算引擎实时生成。

## 原型提示词

+Use case: ui-mockup
Asset type: high fidelity desktop application prototype, single flat front-facing screen.
Design a premium playful Chinese desktop application called 牛马计时器 (salary accrual and countdown to leaving work), titled NIUMA / TIME TO GET PAID. Use an elegant light frosted-glass interface over a warm pale ivory background with soft blurred acidic lime and lilac orbs. Inspired by art-directed lifestyle software, clean precise Swiss typography meets exhausted office-worker humor. Large rounded translucent panels, delicate hairline borders and shadow, subtle grain, beautiful negative space. No physical monitor or device, no surrounding presentation labels. Landscape 1536x1024 composition.
Layout: small minimalist sidebar on left containing brand, 今日搬砖 selected, 牛马账本, 打工配置 and bottom 独立开发 · 开源万岁. Main header with tiny green status dot 正在营业, Tuesday date and live clock, right top settings icon. Large friendly title 又是努力赚窝囊费的一天 and small WORK HARD, GET PAID.
Main large left hero glass card: label 今日已赚, oversized black typographic amount ¥ 186.42, tiny green pill + ¥0.0057 / 秒, small supportive line 每一秒，都没有白忍. A thin chart-like income sparkline and exact 今日目标 ¥275.86. Green progress bar at 67.6%. Bottom of this card a lime pill with small coffee icon 喝口咖啡，接着发财. Main right glass card: a premium whimsical 3D clay exhausted cartoon office horse with tiny cow horns, lavender shirt, crooked dark tie, black eyebags, holding a small coffee cup, lounging with laptop. Funny but endearing, satin finish, studio light, no photorealism. Floating tiny sticker 薪尽自然凉. Under mascot thin heading 距离下班还有 then enormous 02:34:18 then small 再忍一下，即将恢复人形.
Bottom three glass tiles: 今日工时 5h 24m with progress, 本月窝囊费 ¥3,286.42 and 时薪身价 ¥34.48. Elegant small navigation for 本周搬砖 light mini bar chart optional. Need one stunning cohesive functional dashboard, absolutely polished typography, readable simplified Chinese. Palette black ink, ivory, lime #DDF59C, muted lavender; no excessive neon, no dark theme, no generic blue dashboard.

## 角色素材提示词

+Use case: background-extraction
Input image: the generated 牛马计时器 UI prototype, character reference.
Create the SAME premium whimsical 3D clay office horse-cow hybrid mascot from the right panel of this prototype as a standalone isolated asset on genuinely transparent background. Preserve the character identity: tired half-closed eyes, little cow horns, caramel brown horse mane, cream muzzle, muted lavender office shirt, crooked dark charcoal tie, seated at an ivory desk with small lavender laptop at right and holding a white espresso cup with small line cow icon. Same satin clay material, subtle realistic studio shadows, humorous exhausted but cute expression. Frame the whole character, laptop, coffee, minimal desktop and 2 small stacked books at left, with generous transparent margins. No UI, no panels, no background scenery, NO TEXT, NO STICKERS, no badges, no numbers, no speech balloons. Medium wide composition, objects fully within frame. Clean reusable product illustration, no gradient backdrop.
