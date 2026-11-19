# Хексленд — промпты для арта (ChatGPT)

Все картинки генерируем **в одном чате ChatGPT**, чтобы стиль совпал. Готовые файлы кладём в папку **`src/assets/art/`** с именами из таблицы (PNG или WebP) — игра подхватит их сама при сборке, а пока файла нет, остаются значки-заглушки.

> **Готово (нарезано из коллажей):** 7 тайлов (`tile-*.webp`), 5 ресурсов (`res-*.webp`), `harbor-any.webp`, `robber.webp`. Исходники — в папке `картинки/` (не в git).
> **Карты развития и особые карты** — готовы (сгенерированы по одной), пережаты в WebP 640×960; оригиналы PNG — в `картинки/карты/`.
> **Логотип** — готов: `src/assets/art/logo.webp` (эмблема в интерфейсе), иконки вкладки и домашнего экрана — в `public/icons/`, оригинал — `картинки/logo-original.webp`.
> **Образец стиля** для новых генераций (прикреплять к промпту): `картинки/стиль-для-chatgpt.png`.
> Всё готово. Генерировать **строго по одной картинке на сообщение** (иначе ChatGPT повторяет прошлый сюжет).

## Порядок
1. В новом чате ChatGPT первым сообщением отправь **«Стиль»** (ниже).
2. Затем по одному промпту на картинку. Если стиль «уплыл» — прикрепи удачную картинку и напиши: *«в точности в этом стиле»*.
3. Скачай PNG, переименуй как в таблице, положи в `src/assets/art/`.
4. Если фон у иконки не прозрачный — напиши ChatGPT: *«сделай фон прозрачным (transparent PNG)»*.

## Что нужно (20 картинок)

| Файл | Что | Формат |
|---|---|---|
| `tile-forest.png` … `tile-desert.png` (6 шт.) | местность, вид строго сверху | 1024×1024, квадрат на весь холст, без рамки |
| `tile-sea.png` | вода для морской рамки | 1024×1024, бесшовная текстура |
| `res-brick.png` … `res-ore.png` (5 шт.) | иконки ресурсов | 1024×1024, прозрачный фон |
| `harbor-any.png` | иконка гавани 3:1 | 1024×1024, прозрачный фон |
| `robber.png` | фигурка разбойника | 1024×1024, прозрачный фон |
| `dev-knight.png`, `dev-victory.png`, `dev-roads.png`, `dev-plenty.png`, `dev-monopoly.png` | карты развития | 1024×1536 (вертикальная), без текста |
| `bonus-road.png`, `bonus-army.png` | особые карты | 1024×1536, без текста |
| `logo.png` (необязательно) | эмблема-значок | 1024×1024, прозрачный фон |

Гекс я вырезаю из квадрата сам (в коде), поэтому тайлы — **квадратные на весь холст**, без шестиугольника. Числа, фишки игроков и подписи рисуются кодом — на картинках **никакого текста**.

---

## Стиль (первое сообщение)
```
I'm making artwork for my own original board game "Hexland" (resources, trading and building on an island of hexagon tiles). Please keep ONE consistent style for every image I ask for in this chat:

Style: cozy hand-painted board-game illustration, soft gouache/watercolor texture, warm sunny lighting, gentle soft shadows, rich but not oversaturated colors, clean readable shapes that still look good when small, slightly stylized and friendly. Never put any text, letters, numbers, logos, borders, frames or watermarks in the images.

Reply "ok" and wait for my requests.
```

## Тайлы местности (6 + море)
Общее начало для каждого тайла:
```
Square 1024x1024 image. Straight top-down (bird's-eye) view, no horizon, no perspective. The scene fills the whole canvas edge to edge — no border, no frame, no hexagon outline, no vignette. Keep the very center a bit calmer (a small open spot), because a round number token will be placed on top of it.
```
Дальше добавь описание:

**`tile-forest.png`**
```
Scene: a dense forest seen from above — round deciduous and pointed pine tree crowns in several greens, a few chopped logs and a tiny woodcutter's clearing in the middle.
```
**`tile-hills.png`**
```
Scene: reddish-orange clay hills seen from above with clay pits, a small brick kiln and neat stacks of red bricks; terracotta and warm brown tones.
```
**`tile-pasture.png`**
```
Scene: a bright green rolling meadow seen from above with fluffy white sheep grazing, a short wooden fence and a few flowers.
```
**`tile-fields.png`**
```
Scene: golden wheat fields seen from above, arranged in gentle stripes, a few round hay bales and wheat sheaves, warm yellow tones.
```
**`tile-mountains.png`**
```
Scene: grey rocky mountains seen from above with snowy tips, shiny bluish ore veins in the rock and a small mine entrance with a mine cart.
```
**`tile-desert.png`**
```
Scene: warm beige sand dunes seen from above with a few cacti, dry rocks and an animal skull; calm and empty-looking.
```
**`tile-sea.png`**
```
Scene: seamless tileable ocean water texture seen from above, gentle waves, turquoise near the top-left fading to deeper blue, soft white foam highlights. Only water — no land, boats or objects. The left/right and top/bottom edges must tile seamlessly.
```

## Иконки (прозрачный фон)
Общее начало:
```
1024x1024 image, a single centered game icon on a fully transparent background (transparent PNG), slight 3/4 view, chunky stylized shape with a soft dark outline, no background, no ground shadow box, no text. Leave some empty margin around the object.
```
**`res-brick.png`**
```
Object: a neat stack of red clay bricks.
```
**`res-wood.png`**
```
Object: a bundle of three chopped wooden logs tied with rope.
```
**`res-sheep.png`**
```
Object: a cute fluffy white sheep (wool), standing, facing slightly right.
```
**`res-wheat.png`**
```
Object: a golden wheat sheaf tied in the middle.
```
**`res-ore.png`**
```
Object: a small pile of grey rocks with shiny blue-silver metal ore veins.
```
**`harbor-any.png`**
```
Object: a ship's anchor with a coil of rope.
```
**`robber.png`**
```
Object: a mysterious hooded bandit figurine, like a carved wooden board-game piece, dark charcoal cloak, face hidden in shadow, full body, standing.
```
**`logo.png`** (необязательно)
```
Object: an emblem of a small island made of hexagon tiles (forest, wheat fields, mountains, a tiny village) floating in the sea, app-icon style.
```

## Карты развития и особые карты (вертикальные)
Общее начало:
```
Vertical card illustration, 1024x1536 (portrait 2:3). Full-bleed artwork, no border, no frame, no text, no numbers. One clear central subject that reads well when the card is shown small.
```
**`dev-knight.png`**
```
Subject: a brave knight in shining armor on horseback with a banner, chasing a hooded bandit away from a village.
```
**`dev-victory.png`**
```
Subject: a grand stone monument with a golden statue in a festive town square, flags and confetti — a symbol of glory.
```
**`dev-roads.png`**
```
Subject: cheerful workers laying a new cobblestone road through green countryside, a cart with stones nearby.
```
**`dev-plenty.png`**
```
Subject: an overflowing horn of plenty spilling bricks, wooden logs, wool, wheat sheaves and ore rocks.
```
**`dev-monopoly.png`**
```
Subject: a sly merchant behind a market stall hoarding a huge pile of goods and gold coins, grinning.
```
**`bonus-road.png`**
```
Subject: a very long winding road across hills and valleys seen from above, a traveler's wagon on it — the longest road.
```
**`bonus-army.png`**
```
Subject: a proud group of knights with shields and colorful banners standing together on a hill — the largest army.
```
