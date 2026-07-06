# Hilltop RTS — Narrative Bible & Hebrew String Table

Author: Narrative design. Doc language: English. ALL player-facing text: Hebrew (RTL).
Grounding: `docs/research/authenticity.md` (slang bank, name pools, 50 touches, glossary),
`docs/research/balance-theory.md` (7-chapter teach/test/twist ladder, Shabbat rules),
`docs/research/rts-mechanics.md` (event director, telegraphed waves, named individuals).

Every string below is a flat key: `KEY = "Hebrew"`. Keys map 1:1 to a flat i18n JS object
(`i18n["ch1.intro"]`). `{placeholders}` are runtime substitutions. Strings marked `(m/f)` have
a gendered variant key suffixed `_f`. Tone rules (from authenticity research): plans get
בעזרת השם, good news gets ברוך השם, disasters get הכול לטובה through gritted teeth; humor is
dry and self-deprecating (the generator, the donkey, city people). Never preachy, never grim.

---

## 1. Game Title

Six candidates considered:

1. **רוח בגבעה** — "Spirit/Wind on the Hill." Double meaning: רוח is literally our morale
   resource AND the hilltop wind. Short, singable, warm.
2. אחיזה — "Foothold." Strong but cold; sounds like a strategy manual.
3. משמר הגבעה — "Guard of the Hill." Over-indexes on combat; we're 70% pastoral.
4. מאחז — "Outpost." Accurate, but a noun with baggage and no warmth.
5. עולים לגבעה — "Going Up the Hill." Great verb energy, slightly long for a logo.
6. שבע גבעות — "Seven Hills." Nice for 7 chapters, but generic (Rome vibes).

**WINNER: רוח בגבעה** with subtitle **סיפור של חווה אחת בהרי השומרון**
("A story of one farm in the Samarian hills"). Rationale: it names the core resource, the
weather, and the vibe in two words; it reads as a song title, matching the kumzitz soul of
the game. The English working name stays "Hilltop RTS" (code only, never shown).

```
game.title = "רוח בגבעה"
game.subtitle = "סיפור של חווה אחת בהרי השומרון"
game.tagline = "לבנות, לרעות, לשמור — ולשיר"
```

---

## 2. Cast — Recurring Characters

Eight recurring characters. The PLAYER is an unvoiced, unnamed "רכז הגבעה" (hill coordinator);
all narration arrives as letters, radio chatter, and notes pinned to the caravan door — never
cutscenes. Cast bios (English) + their string keys (Hebrew):

| Character | Role | Personality in one line |
|---|---|---|
| **שיבי (אלישיב)**, 19 | Founder, your second-in-command, chapter-intro letter writer | Incurable optimist; answers every disaster with "אין ייאוש בעולם כלל" and a grin |
| **נריה**, 16 | The shepherd | Barely speaks to humans, knows every ewe by name and mood; the flock follows him like Waze |
| **תהילה**, 22 | Cheese-maker & medic from the neighboring family farm | Dry humor, zero patience for excuses, best labneh in Samaria |
| **הרב יהודה** | "The tremp rabbi" — battered Transit van, picks up everyone | Delivers supplies, news, and one-line Torah wisdom; his brakes are a matter of faith |
| **אמא רחל** | Amichai's mother, arrives every Friday with challot | Warm artillery: feeds everyone, inspects the kitchen, leaves detergent as a hint |
| **דודו הגנרטורצ'יק**, 47 | Fix-it man, ex-kibbutznik | Cynical outside, marshmallow inside; fixes the generator with a wrench, a kick, and a psalm |
| **מוישי**, 15 | Youngest on the hill, owner of the kosher Nokia with infinite battery | Comic relief; quotes Rebbe Nachman at the worst possible moments; everyone borrows his phone |
| **הפקח** | "The one from the Administration" — recurring inspector, white 4x4, yellow beacon | Not a villain: tired, polite, by-the-book; sighs a lot; the conflict is with paper, not with him |

```
cast.shivi.name = "שיבי"
cast.shivi.desc = "מייסד הגבעה. אופטימי חשוכת מרפא — כל אסון נגמר אצלו ב'אין ייאוש בעולם כלל'."
cast.neriya.name = "נריה"
cast.neriya.desc = "הרועה. מדבר מעט עם אנשים, הרבה עם כבשים. העדר הולך אחריו כמו וייז."
cast.tehila.name = "תהילה"
cast.tehila.desc = "מהחווה השכנה. גבינות אלופות הארץ, הומור יבש, ואפס סבלנות לתירוצים."
cast.rav.name = "הרב יהודה"
cast.rav.desc = "רב הטרמפים. טרנזיט מקרטע, לב ענק, ודבר תורה לכל פקק. הבלמים — עניין של אמונה."
cast.rachel.name = "אמא רחל"
cast.rachel.desc = "אמא של עמיחי. מגיעה כל שישי עם חלות, בודקת את המטבח, ומשאירה סבון כלים כרמז."
cast.dudu.name = "דודו הגנרטורצ'יק"
cast.dudu.desc = "איש התיקונים. מתקן גנרטור עם מפתח שוודי, בעיטה ופרק תהילים — בסדר הזה."
cast.moishy.name = "מוישי"
cast.moishy.desc = "הצעיר בגבעה. נוקיה כשר עם סוללה נצחית שכולם שואלים, וציטוט מרבי נחמן לכל מצב."
cast.inspector.name = "הפקח"
cast.inspector.desc = "ההוא מהמנהל. ג'יפ לבן, צ'קלקה צהובה, טפסים. לא רשע — פקיד. נאנח הרבה."
```

### Naming pools (assigned randomly at spawn; UI shows these on hover)

```
names.sheep.1 = "ברטה"
names.sheep.2 = "גברת כהן"
names.sheep.3 = "פחזנייה"
names.sheep.4 = "ביסלי"
names.sheep.5 = "שולמית"
names.sheep.6 = "פשוש"
names.sheep.7 = "מלכה"
names.sheep.8 = "כתם"
names.sheep.9 = "שחורה"
names.sheep.10 = "פרח"
names.sheep.11 = "קרמבו"
names.sheep.12 = "בקלאווה"
names.sheep.13 = "פופקורן"
names.sheep.14 = "סופגנייה"
names.sheep.15 = "ציפורה"
names.sheep.16 = "עוגייה"
names.dog.1 = "סימבה"
names.dog.2 = "לביא"
names.dog.3 = "במבה"
names.dog.4 = "סופה"
names.dog.5 = "זאב"
names.dog.6 = "שומר"
names.dog.7 = "חומוס"
names.dog.8 = "גולדה"
names.dog.9 = "רקס"
names.dog.10 = "בלק"
names.donkey.1 = "חמודי"
names.donkey.2 = "בלעם"
names.donkey.3 = "שרגא"
names.donkey.4 = "מסי"
names.donkey.5 = "פרדיננד"
names.donkey.6 = "מרגוזה"
names.settler.male = "אלישיב,נריה,עמיחי,הראל,ידידיה,שילה,בועז,צורי,דביר,איתמר,אחיה,נחמן,שמוליק,יאיר,מלאכי,אוריה"
names.settler.female = "תהילה,אמונה,הלל,נעמה,איילה,שיראל,הודיה,רננה,תכלת,מוריה,נוגה,יערה"
names.hill.pool = "גבעת הרועים,מצפה אחיה,חוות אור הנר,גבעת שדה בועז,מעוז צורי,רמת איתן,גבעת המעיין,נקודת חן"
```

---

## 3. Menus, HUD & Core UI

```
menu.new_game = "משחק חדש"
menu.continue = "המשך משחק"
menu.campaign = "המסע — שבעה פרקים"
menu.freeplay = "משחק חופשי"
menu.settings = "הגדרות"
menu.credits = "יוצרים"
menu.save = "שמירה"
menu.load = "טעינה"
menu.export_save = "גיבוי שמירה לקובץ"
menu.import_save = "טעינת שמירה מקובץ"
menu.difficulty.label = "רמת קושי"
menu.difficulty.easy = "רגוע בגבעה"
menu.difficulty.normal = "חיים על הגבעה"
menu.difficulty.hard = "מסירות נפש"
menu.retry_shabbat = "נסה שוב מהשבת האחרונה"
menu.chapter_select = "בחירת פרק"
menu.sound = "צלילים"
menu.music = "מוזיקה"
menu.camera_mode = "מצב מצלמה"
menu.camera_iso = "מבט על הגבעה"
menu.camera_cine = "מבט קרוב"
res.wood = "עץ"
res.stone = "אבן"
res.food = "אוכל"
res.water = "מים"
res.shekels = "שקלים"
res.spirit = "רוח"
hud.day = "יום {n}"
hud.week = "שבוע {n}"
hud.days_to_shabbat = "עוד {n} ימים לשבת"
hud.tomorrow_shabbat = "מחר שבת — מסיימים הכנות!"
hud.friday = "יום שישי! עד השקיעה מסיימים הכול"
hud.shabbat = "שבת שלום"
hud.motzash = "מוצאי שבת — שבוע טוב!"
hud.population = "נפשות: {n}/{max}"
hud.flock = "העדר: {n}"
hud.idle = "ידיים פנויות: {n}"
hud.pause = "עצירה"
hud.speed1 = "רגיל"
hud.speed2 = "מהיר"
hud.speed3 = "טורבו (כמו החמור, רק הפוך)"
btn.alarm = "פעמון הגבעה!"
btn.alarm.tip = "אזעקה: כבשים לדיר, ילדים לקרוואן, כולם לעמדות"
btn.release_dogs = "שחרר את הכלבים"
btn.release_dogs.tip = "כל הכלבים קופצים על האיום הקרוב. זמן טעינה עד הבוקר."
btn.everyone_out = "כולם החוצה!"
btn.everyone_out.tip = "כל הגבעה רצה החוצה עם פנסים ורעש. מבריח כמעט הכול. פעם ביום."
btn.call_volunteers = "קרא לשומרים מתנדבים"
btn.call_volunteers.tip = "טלפון אחד מהנוקיה של מוישי — ומגיעים חברים לשמירה. עולה רוח."
btn.skip_shabbat = "לנוח עד צאת השבת"
btn.build = "בנייה"
btn.dismantle = "פירוק (מחזיר חלק מהחומרים)"
btn.repair = "תיקון"
ui.select_all_idle = "כל הפנויים"
ui.to_shelter = "למחסה"
ui.confirm = "סבבה"
ui.cancel = "בעצם לא"
ui.not_now_shabbat = "שבת היום, אחי. זה יחכה למוצ״ש."
ui.paused_banner = "עצירה — תנשום, תחשוב, תשתה מרווה"
ui.autosave = "נשמר. (כמו נר שבת — קבוע ובזמן)"
```

---

## 4. Chapters — Titles, Intros (letter/radio style), Win/Lose

Chapter intros are letters from שיבי or radio/phone messages; each ends setting the goal.
Win texts are triumph-screen copy (Against-the-Storm style exhale). Lose texts always reframe
to hope + a concrete lesson (per anti-frustration research).

```
ch1.title = "עולים לגבעה"
ch1.intro = "אחי, מצאנו אותה! גבעה עם מעיין קטן, עץ שקד עתיק ונוף עד הים. הבאנו אוהל, ג'ריקנים וערימת פלטות — כל השאר בעזרת השם. תעלה, מחכים לך למעלה. — שיבי"
ch1.win = "יש אוהל, יש מים, יש אש — והתן שהסתובב פה הבין שאין מה לחפש. הגבעה כבר לא סתם גבעה. היא בית. חזק וברוך!"
ch1.lose = "ירדנו מהגבעה הלילה. לא נורא, אחי — אין ייאוש בעולם כלל. מחר עולים שוב, והפעם קודם מים ואוכל, אחר כך חלומות."

ch2.title = "שבת ראשונה"
ch2.intro = "שבת ראשונה על הגבעה! אמא רחל שולחת חלות עם הרב יהודה. אבל נריה שמע יללות בוואדי — זאבים, והם עוד לא שמעו על מנוחת שבת. תכין את הדיר לפני השקיעה: בשבת שומרים, אבל לא בונים ולא מתקנים."
ch2.win = "מוצאי שבת, והעדר ספור — כולן פה, עד הכבשה האחרונה. ככה נראה נס קטן: חלות, זמירות, וזאבים שהלכו הביתה רעבים."
ch2.lose = "הזאבים לקחו יותר מדי הלילה. נכנסה שבת ולא היינו מוכנים. הלקח כואב אבל פשוט: ביום שישי מכינים הכול — גדר שלמה, שומר ער, כלב בעמדה."

ch3.title = "חזירים בכרם"
ch3.intro = "זרענו ערוגות ונטענו גפנים — ובלילה שמענו נחירות מהוואדי. חזירי בר, אחי. טרקטורים עם רגליים. דודו מביא שני גורי רועים מהחווה של בועז — תבנה מלונה, תמתח גדרות, ותשמור על הכרם משני הכיוונים."
ch3.win = "הכלבים גירשו את החזירים, הכרם עומד, והערוגות שלמות. נריה כבר נתן לגורים שמות ואוכל מהצלחת שלו. הגבעה גדלה."
ch3.lose = "בבוקר מצאנו את הערוגות הפוכות כמו אחרי חריש. חזירים לא מרחמים על טירונים. עוד גדר, עוד כלב, עיניים לשני כיוונים — ומנסים שוב. הכול לטובה."

ch4.title = "הנייר על הקרוואן"
ch4.intro = "ג'יפ לבן עם צ'קלקה עלה בבוקר. ההוא מהמנהל הדביק נייר על הקרוואן — צו הריסה. יש כמה ימים להחליט: מפרקים לבד ומצילים את החומרים, או מרימים טלפונים וכל הארץ עולה לחזק אותנו. ובלילות מסתובב טנדר של גנבי כבשים. שבוע עמוס. בעזרת השם."
ch4.win = "הקרוואן עומד, העדר שלם, והנייר — היסטוריה. ראית כמה אנשים באו בשבילנו? אוטובוסים על דרך עפר. עם ישראל חי."
ch4.lose = "איבדנו את הקרוואן, וגם כבשים חסרות. כואב. אבל תרשום מה שאמר הרב יהודה בטרמפ: 'בניין שנפל — בונים. לב שנפל — מרימים.' מתחילים מחדש, חכמים יותר."

ch5.title = "אורות במגדל"
ch5.intro = "תנים זה סיפור אחד — רעולי פנים זה סיפור אחר. אתמול בלילה ניסו לפרוץ מחסן בחוות אור הנר. פושעים בלי פנים, שבורחים מאור ומרעש. דודו מרתך לנו מגדל שמירה ותהילה שלחה פנסים. שיהיה ברור לכולם: הגבעה הזאת ערה."
ch5.win = "הם ברחו כמו שבאו — בחושך ובלי כלום. המגדל דלק כל הלילה, הכלבים לא נתנו להם מטר, ואף אחד לא נפגע. חזק וברוך, שומרי הגבעה."
ch5.lose = "הם הספיקו לפרק ולקחת. המגדל לא היה גמור והכלבים נשארו לבד מול בני אדם. שומרים אף פעם לא לבד — קלע מאחורי כל כלב, ואור על כל פינה."

ch6.title = "הדרך לצומת"
ch6.intro = "הגבינה של תהילה הולכת חזק בצומת — יש ביקוש, יש שקלים! אבל כל משלוח לוקח ידיים מהגבעה: טרמפ לשם, דוכן, טרמפ חזרה. ומישהו שם למטה שם לב מתי אנחנו חסרים. תבנה משק שעומד גם כשחצי חבורה בדרכים."
ch6.win = "דוכן קבוע בצומת, עדר בריא, וקופה מלאה שקלים. הגבעה מפרנסת את עצמה — תכלס, חווה אמיתית. אפילו אמא רחל התרשמה, וזה הכי קשה שיש."
ch6.lose = "בדיוק כשהיינו בצומת — הם באו. חזרנו עם שקלים ובלי חצי דיר. עסקה גרועה. קודם ביטחון, אחר כך מסחר: לא יוצא משלוח לפני שיש שומר, כלב ומגדל דולק."

ch7.title = "מוצאי שבת"
ch7.intro = "שמועות מכל הגבעות: מישהו איחד את כל הגנבים באזור, והם מחכים למוצאי שבת — בדיוק כשכולם עייפים ושמחים מהסעודות. שבת אחת של שקט נשארה. תתפלל, תשיר, תטען רוח עד הסוף — ובצאת הכוכבים: הבדלה, ואז כולם לעמדות."
ch7.win = "עלה השחר — וכולם פה. הכבשים, הכלבים, האנשים, האש. הם באו בגדול וברחו בקטן. עוד שבע שנים יספרו סביב המדורה על הלילה הזה. עם ישראל חי!"
ch7.lose = "הלילה הזה היה גדול עלינו. אבל תסתכל סביב: אנשים שלמים, בוקר חדש, וגבעה שיודעת בדיוק איפה היא צריכה להתחזק. גבעה שנופלת — קמה. אין ייאוש בעולם כלל."

ch.next = "לפרק הבא"
ch.replay = "לשחק שוב את הפרק"
ch.tally = "סיכום הפרק"
ch.tally.sheep_saved = "כבשים ניצלו: {n}"
ch.tally.waves = "מתקפות שנהדפו: {n}"
ch.tally.spirit_peak = "שיא הרוח: {n}"
```

---

## 5. Tutorial Script (Chapter 1, slangy-but-clear)

Sequential, one instruction per step, each waits for completion. Voice: שיבי talking to the
player. Every step names the exact UI action once, in plain words.

```
tut.welcome = "ברוך הבא לגבעה, אחי! נעשה סדר בקטנה — קודם כול מקימים אוהל, שיהיה איפה לישון."
tut.camera = "רגע, קודם תסתכל סביב: גרור עם העכבר כדי לסובב, גלגלת כדי להתקרב. תספוג את הנוף — בשביל זה עלינו."
tut.select = "לחץ על נריה כדי לבחור אותו. רואה את העיגול מתחתיו? הוא איתך."
tut.move = "עכשיו קליק ימני על הקרקע — והוא הולך לשם. פשוט כמו לתפוס טרמפ."
tut.build_open = "פתח את תפריט הבנייה למטה ובחר 'אוהל'."
tut.build_place = "שים את האוהל במקום ישר — לא על סלעים, לא על הוואדי. ירוק = טוב, אדום = חפש מקום אחר."
tut.gather_wood = "צריך עץ. בחר מתיישב ועשה קליק ימני על עץ יבש. יאללה לעבודה."
tut.water = "מים זה חיים פה. שלח מישהו עם ג'ריקן למעיין — קליק ימני על המעיין וזהו."
tut.food = "בטן מקרקרת? תקים ערוגת ירקות קרוב למים. בעזרת השם בקרוב יהיה גם עדר."
tut.sheep = "הנה העדר! שים לב — לכל כבשה יש שם. תעביר עכבר על אחת. תגיד שלום לברטה."
tut.shepherd = "בחר את הרועה ושלח אותו עם העדר למרעה. עם קלע ביד — אף תן לא מתקרב."
tut.dog = "הכלב שומר על העדר לבד, בלי פקודות. רק תדאג לו למלונה ולאוכל, והוא ידאג לשאר."
tut.night = "לילה ראשון על הגבעה. שומע את התנים? יפה מרחוק, פחות יפה מקרוב. שיהיה תמיד שומר ער."
tut.telegraph = "רואה את הכלב נובח לכיוון הוואדי ואת החץ במפה? משהו בדרך. יש לך דקה להתארגן — זה הרבה."
tut.alarm = "כשצרה מתקרבת — תלחץ על פעמון הגבעה: כבשים לדיר, ילדים לקרוואן, כולם לעמדות. תנסה עכשיו."
tut.chase = "בחר את הרועה ועשה קליק ימני על התן — הוא יגרש אותו ויחזור לעבודה לבד. אנחנו מגרשים, לא רודפים."
tut.shabbat = "יום שישי, אחי! עד השקיעה מסיימים בנייה ואיסוף. בשבת לא עובדים — אבל שמירה זה פיקוח נפש, תמיד."
tut.spirit = "רואה את מד הרוח? שבת, קומזיץ ושירה ממלאים אותו. כשהרוח גבוהה — עובדים מהר וחזק. כשהיא נמוכה... אתה תרגיש."
tut.kumzitz = "מוצאי שבת = קומזיץ! תדליק את המדורה, הגיטרה כבר תגיע לבד. תראה איך הרוח מטפסת."
tut.junction = "צריך שקלים? שלח מישהו לצומת עם גבינות. טרמפ לשם, דוכן, טרמפ חזרה — וחוזרים עם כסף."
tut.repair = "גדר שבורה זו הזמנה מודפסת לצרות. בחר מתיישב, לחץ על הגדר — והיא מתוקנת."
tut.done = "זהו, אתה מסודר! תבנה, תרעה, תשמור — והכי חשוב: תשמור על הרוח. הגבעה הזאת עליך עכשיו. בהצלחה, מלך!"
```

---

## 6. Unit Barks (text-only, shown as floating speech chips)

3–5 per state. System picks randomly, never repeats last one. Dogs/donkey barks are
onomatopoeia + stage-direction humor in parentheses (cheap, on-tone, needs no audio VO).

```
bark.settler.select.1 = "כן אחי?"
bark.settler.select.2 = "מה קורה, צדיק?"
bark.settler.select.3 = "פה אני, ברוך השם."
bark.settler.select.4 = "דבר אליי."
bark.settler.order.1 = "סבבה."
bark.settler.order.2 = "יאללה, על זה."
bark.settler.order.3 = "בקטנה."
bark.settler.order.4 = "רץ."
bark.settler.work.1 = "יש עבודה — יש שמחה."
bark.settler.work.2 = "בעזרת השם יהיה בניין."
bark.settler.flee.1 = "אוי אוי אוי!"
bark.settler.flee.2 = "לקרוואן!"
bark.settler.flee.3 = "תקראו לכלב!!"
bark.shepherd.select.1 = "העדר איתי."
bark.shepherd.select.2 = "כולן ספורות."
bark.shepherd.select.3 = "מה עם הכבשים שלי?"
bark.shepherd.order.1 = "יאללה ברטה, זזים."
bark.shepherd.order.2 = "העדר בתנועה."
bark.shepherd.order.3 = "הולך עם המקל."
bark.shepherd.chase.1 = "קלע ביד!"
bark.shepherd.chase.2 = "מהעדר שלי?! עוף מפה!"
bark.shepherd.chase.3 = "לא היום, חביבי."
bark.shepherd.flee.1 = "העדר לדיר! מהר!"
bark.shepherd.flee.2 = "סימבה, אליי!"
bark.guard.select.1 = "עיניים פקוחות."
bark.guard.select.2 = "הכול שקט... בינתיים."
bark.guard.select.3 = "שומר מקשיב."
bark.guard.order.1 = "עובר עמדה."
bark.guard.order.2 = "מכסה את הכיוון הזה."
bark.guard.order.3 = "קיבלתי."
bark.guard.chase.1 = "עצור!! מי שם?!"
bark.guard.chase.2 = "מפה אתה לא עובר!"
bark.guard.chase.3 = "תעירו את כולם!"
bark.guard.flee.1 = "צריך גיבוי, עכשיו!"
bark.guard.flee.2 = "הם יותר מדי — פעמון!!"
bark.dog.select.1 = "הב!"
bark.dog.select.2 = "הב הב? (מכשכש בזנב)"
bark.dog.select.3 = "(מטה את הראש הצידה)"
bark.dog.order.1 = "הב הב! (רץ בשמחה)"
bark.dog.order.2 = "(דוהר לפני שסיימת להצביע)"
bark.dog.attack.1 = "גררררר!!"
bark.dog.attack.2 = "הב הב הב הב!!"
bark.dog.attack.3 = "(שיניים, אבק, בלגן)"
bark.dog.flee.1 = "(יבבה. חוזר עם האוזניים למטה)"
bark.donkey.select.1 = "היא־הא?"
bark.donkey.select.2 = "(מבט עייף של אלפיים שנה)"
bark.donkey.order.1 = "היא־הא... (נאנח ומתחיל ללכת)"
bark.donkey.order.2 = "(זז. לאט. בתנאים שלו.)"
bark.donkey.refuse.1 = "(לא זז. תביא חצי גזר ונדבר.)"
bark.donkey.loaded.1 = "(מרים מבט לשמיים. ממשיך לסחוב.)"
```

---

## 7. Event Texts

All events follow the telegraph→hit→resolve pattern. `{dir}` is a compass word,
`{name}` an animal/settler name, `{n}` a number, `{building}` a building name.

```
dir.north = "צפון"
dir.south = "דרום"
dir.east = "מזרח"
dir.west = "מערב"

evt.raid.warn = "הכלבים משתגעים לכיוון {dir}! אבק על הדרך — רעולי פנים בדרך לגבעה!"
evt.raid.hit = "רעולי פנים בשטח! הם הולכים על המחסנים — כולם לעמדות!"
evt.raid.win = "ברחו! נעלמו בוואדי כמו שבאו. ספירת מלאי, נשימה עמוקה, ותה מרווה לכולם."
evt.raid.loss = "הם הספיקו לפרק את {building} לפני שברחו. מחר מתקנים — הלילה שומרים כפול."
evt.raid.leader_down = "ראש הכנופיה נפל מאבן קלע — וכל השאר התאדו! ככה זה עם פחדנים."

evt.wolves.warn = "יללות מהוואדי ב{dir}... נריה אומר: זאבים, והם מריחים את העדר."
evt.wolves.hit = "זאבים בין הכבשים!! כלבים, רועים — לדיר, עכשיו!"
evt.wolves.win = "הזאבים ברחו עם הזנב בין הרגליים. העדר ספור — כולן פה, ברוך השם."
evt.wolves.sheep_lost = "הזאבים לקחו את {name}... נריה יושב ליד הדיר ולא מדבר. הרוח יורדת."

evt.jackals.warn = "להקת תנים מסתובבת ליד הדיר. חצופים, אבל פחדנים — כלב אחד מספיק."
evt.jackals.win = "התנים התחפפו. עוד יחזרו לילל מרחוק — שירת רקע של הגבעה."

evt.boars.warn = "נחירות בחושך מ{dir}... חזירי בר בדרך לערוגות! מי שזרע — שישמור."
evt.boars.hit = "חזירים בערוגות!! הם הופכים הכול — תרעישו, תשחררו כלבים!"
evt.boars.win = "החזירים ברחו במורד. הערוגות קצת חבוטות אבל שלמות. תוסיף גדר בכיוון ההוא."
evt.boars.aftermath = "בוקר טוב... החזירים עברו בלילה והפכו את הערוגות כמו מחרשה. הכול לטובה — היום שותלים מחדש."

evt.thieves.warn = "טנדר חשוד כבה אורות למטה בדרך העפר. גנבי מקנה. הכלבים כבר יודעים."
evt.thieves.hit = "גנבים ליד הדיר!! הם מנסים להעמיס כבשים — אור, רעש, כולם החוצה!"
evt.thieves.grabbed = "הם חטפו את {name}!! עוד אפשר להשיג אותם לפני הטנדר — רוץ!"
evt.thieves.recovered = "{name} חזרה הביתה! רועדת, שלמה, ועם סיפור לספר לעדר. חסדי השם."
evt.thieves.win = "הגנבים ברחו בידיים ריקות. הטנדר חרק גלגלים ונעלם. שמירה כפולה השבוע."
evt.thieves.loss = "הטנדר נעלם ואיתו {name}... כבשה עם שם זה לא 'אבדה'. זה חור בלב ובעדר."

evt.demolition.served = "ג'יפ לבן בשער. הפקח הדביק צו הריסה על {building}. נאנח, הצטער, נסע. יש לנו {n} ימים."
evt.demolition.countdown = "עוד {n} ימים לצו על {building}. מפרקים לבד ומצילים חומרים — או מרימים את כל הארץ?"
evt.demolition.choice_dismantle = "לפרק לבד (מחזיר את רוב החומרים)"
evt.demolition.choice_muster = "להזעיק תומכים להקפאת הצו (עולה רוח: {n})"
evt.demolition.dismantled = "פירקנו לבד, בשקט ובכאב. פלטה פלטה. החומרים איתנו — נבנה מחדש, חכם יותר. הכול לטובה."
evt.demolition.frozen = "זה עבד!! מכתב מעורך הדין, מאות תומכים על הגבעה — הצו הוקפא! שיבי עומד על המכולה וצועק: עם ישראל חי!"
evt.demolition.expired = "לא הספקנו להחליט. הטרקטור עלה בבוקר ולקח את {building}. שקט כבד על הגבעה... אבל אנחנו עוד פה. וזה העיקר."
evt.supporter_bus = "אבק על דרך העפר — שלושה אוטובוסים! מאות תומכים עולים ברגל עם דגלים, גיטרות ובורקסים. הרוח מזנקת!"

evt.drought.start = "המעיין נחלש... שרב כבד יושב על ההרים. מהיום כל ג'ריקן שווה זהב — תוסיף סבבי מים."
evt.drought.end = "המעיין חזר לפכפך! השרב נשבר. אפשר לנשום — ולהשקות."
evt.storm.warn = "עננים שחורים מ{dir}. סערה בדרך — תקשרו את הפחים, תכניסו את העדר, תעגנו את האוהלים!"
evt.storm.hit = "הסערה פה!! רוח משוגעת, גשם בצדדים — כולם בפנים חוץ מהשומר!"
evt.storm.damage = "הסערה קרעה את רשת הצל והפילה גדרות. יאללה, מגפיים — מתקנים."
evt.storm.end = "השמיים נפתחו, הכול ירוק ורטוב. נזק יש, אבל גם בורות מים מלאים. הכול לטובה — הפעם באמת."

evt.shabbat.enter = "שקיעה. נרות בחלון הקרוואן, חולצות לבנות, ריח חמין. שבת שלום, הגבעה — העבודה נעצרת, הנשמה נחה."
evt.shabbat.exit = "שלושה כוכבים. נר הבדלה, ריח בשמים, 'שבוע טוב!' — וחוזרים לעבודה עם רוח מלאה."
evt.shabbat.guard_note = "גם בשבת שומרים — פיקוח נפש. הכלבים והשומרים בעמדות, כרגיל."
evt.kumzitz = "קומזיץ!! מדורה, גיטרה עם מיתר חסר, מרשמלו ושירים עד השעות הקטנות. הרוח עולה ועולה."
evt.first_rain = "יורה!!! גשם ראשון! כולם רצים החוצה עם הפנים לשמיים. 'ברוך השם!' — השנה החדשה של הגבעה מתחילה."
evt.generator.broken = "הגנרטור נתקע. שוב. דודו כבר בדרך עם מפתח שוודי ופרק תהילים."
evt.generator.fixed = "שלוש בעיטות, ברכה אחת — והגנרטור חזר לחיים! (מחיאות כפיים מכל הגבעה)"
evt.volunteers = "יום מתנדבים! אוטובוס של ישיבה עצר למטה — המון ידיים, המון רעש, והם אוכלים הכול. שווה את זה."
evt.rav_visit = "הטרנזיט של הרב יהודה מטפס בדרך. שיעור קצר, סיפור ארוך, וארגז עגבניות מתנה. הרוח עולה."
evt.rachel_visit = "אמא רחל הגיעה עם חלות, קוגל והערות על המטבח. הגבעה מסודרת כמו שלא הייתה מעולם."
evt.lamb_born = "טלה נולד הלילה! {name} כבר מטפל בו עם בקבוק. יש חדש בעדר — והוא הולך לעקוב אחריך לכל מקום."
evt.sheep_lost = "כבשה חסרה בספירת הערב... {name} נשארה איפשהו בוואדי. פנסים, כלב אחד — ויוצאים לחפש לפני התנים."
evt.sheep_found = "מצאנו את {name}!! תקועה בין סלעים, רועדת ושלמה. נריה חייך. זה נדיר. תרשום ביומן."
evt.sharav = "שרב. האוויר עומד, הצל לא עוזר, והעדר מתנשף. עבודה לאט, מים כפול — ולחכות שיעבור."
evt.brushfire = "עשן מהעשב היבש ליד {dir}!! שריפת קוצים — כולם עם מטאטאים וברזנטים, לעצור אותה לפני הדיר!"
evt.brushfire.win = "השריפה כובתה. פנים מפויחות, עיניים דומעות, חיוכים ענקיים. הגבעה שחורה קצת — אבל שלנו."
```

---

## 8. Buildings & Units — Names + Tooltip Flavor

One line of mechanics is appended by the UI from data; these strings are name + flavor only.

```
bld.tent.name = "אוהל"
bld.tent.flavor = "הבית הראשון של כל גבעה. קר בחורף, חם בקיץ, מלא אהבה כל השנה."
bld.caravan.name = "קרוואן"
bld.caravan.flavor = "לבן, חלוד, עם דוד שמש על הגג. נכנסות שתי נפשות — בצפיפות אוהבת."
bld.container.name = "מכולה"
bld.container.flavor = "מחסן פלדה עם חלון שנחתך בדיסק. מה שלא נכנס לקרוואן — נכנס לפה."
bld.shack.name = "צריף פלטות"
bld.shack.flavor = "נבנה ביום, עף בסערה, נבנה שוב ביום. זה בדיוק הקטע שלו."
bld.pen.name = "דיר"
bld.pen.flavor = "צינורות, פלטות ורשת צל ירוקה. הבית של העדר — תשמור עליו כמו על הבית שלך."
bld.zula.name = "זולה"
bld.zula.flavor = "ספות מהרחוב, שטיח על העפר, גיטרה על עמוד. פה נחים הצדיקים אחרי יום עבודה."
bld.campfire.name = "מדורה"
bld.campfire.flavor = "טבעת אבנים, קומקום שחור מפיח, וגחלים שתמיד חמות. הלב הפועם של הגבעה."
bld.watertower.name = "מגדל מים"
bld.watertower.flavor = "טנק שחור על רגלי פלדה. בונוס: מהסולם שלו יש קליטה סלולרית."
bld.cistern.name = "בור מים עתיק"
bld.cistern.flavor = "אבותינו חצבו, אנחנו ניקינו, הגשם ימלא. אלפיים שנה של הנדסת מים."
bld.generator.name = "גנרטור"
bld.generator.flavor = "רועש, עצבני, שותה סולר כמו מים. בלעדיו — חושך. איתו — אור ורעש."
bld.watchtower.name = "מגדל שמירה"
bld.watchtower.flavor = "רואים ממנו רחוק, ורואים אותו מרחוק. שכולם יידעו: הגבעה הזאת ערה."
bld.fence.name = "גדר"
bld.fence.flavor = "פלטות, יתדות וחוט. לא עוצרת הכול — אבל מודיעה, מעכבת, ומרגיזה בדיוק מספיק."
bld.kennel.name = "מלונה"
bld.kennel.flavor = "בית קטן לחברים הכי נאמנים על הגבעה. שמיכה ישנה בפנים — חובה."
bld.vegetable.name = "ערוגת ירקות"
bld.vegetable.flavor = "עגבניות, מלפפונים ותקווה. גם החזירים בדעה שיצא מצוין."
bld.vineyard.name = "כרם"
bld.vineyard.flavor = "גפנים צעירות על תיל, טרסות עתיקות מתחת. בציר ראשון — חג של גבעה שלמה."
bld.olive.name = "מטע זיתים"
bld.olive.flavor = "עצים צעירים ליד סבים עתיקים ומפותלים. מסיק בסתיו, שמן כל השנה."
bld.dairy.name = "מחלבה"
bld.dairy.flavor = "חלב נכנס, גבינה יוצאת, שקלים חוזרים מהצומת. האימפריה של תהילה."
bld.pergola.name = "פרגולה"
bld.pergola.flavor = "עמודי פלטות ורשת צל. חדר האוכל, חדר הישיבות וחדר הוויכוחים — הכול ביחד."
bld.synagogue.name = "פינת בית כנסת"
bld.synagogue.flavor = "ארון קודש, מדף סידורים, וכיסאות פלסטיק. מניין כשמצליחים, כוונה תמיד."
bld.outhouse.name = "שירותי שדה"
bld.outhouse.flavor = "צריפון עם דלת חורקת ונוף לוואדי. עירוניים נשברים פה ראשונים."

unit.settler.name = "מתיישב/ת"
unit.settler.flavor = "בונה, סוחב, זורע ומתפלל — הכול בסנדלים ועם חיוך מאובק."
unit.shepherd.name = "רועה"
unit.shepherd.flavor = "מקל, קלע, כיפה גדולה וציציות ברוח. יודע כל כבשה בשמה ובמצב הרוח שלה."
unit.guard.name = "שומר"
unit.guard.flavor = "פנס, תרמוס קפה שחור וניגון שקט. ער כשכל הגבעה ישנה."
unit.dog.name = "כלב רועים"
unit.dog.flavor = "מהיר, נאמן, ושונא תנים ברמה האישית. הביטוח הכי טוב של העדר."
unit.donkey.name = "חמור"
unit.donkey.flavor = "מערכת הלוגיסטיקה של הגבעה. סוחב הכול, ממהר לשום מקום, צודק תמיד."
unit.sheep.name = "כבשה"
unit.sheep.flavor = "צמר, חלב, ושם פרטי. הנכס הכי יקר על הגבעה — והכי נחטף."
unit.goat.name = "עז"
unit.goat.flavor = "חכמה מדי, זריזה מדי, ועם פעמון. מנהיגת העדר בפועל, בלי בחירות."
unit.lamb.name = "טלה יתום"
unit.lamb.flavor = "גדל על בקבוק, בטוח שהוא בן אדם. עוקב אחריך לכל מקום ומעלה רוח לכולם."

threat.jackal.name = "תן"
threat.jackal.flavor = "יללה בלילה, עיניים בחושך, אומץ של אפס. כלב אחד מספיק לו."
threat.wolf.name = "זאב"
threat.wolf.flavor = "טורף אמיתי. בא בשקט, עובד מהר — והכבשים שלך זה בדיוק התפריט שלו."
threat.boar.name = "חזיר בר"
threat.boar.flavor = "טרקטור עם רגליים ורעב לענבים. הופך ערוגה שלמה בלילה אחד. שונא רעש."
threat.thief.name = "גנב מקנה"
threat.thief.flavor = "מגיע עם טנדר וכיסוי פנים, בורח מאור, מרעש ומכלבים. הכבשים לא מעניינות אותו — רק הכסף."
threat.raider.name = "רעול פנים"
threat.raider.flavor = "פושע בלי פנים ובלי סיפור. מחפש רכוש קל. כשקשה — הוא פשוט נעלם."
threat.raider_leader.name = "ראש הכנופיה"
threat.raider_leader.flavor = "הגדול והחצוף שבהם. כשהוא נשבר ובורח — כולם בורחים איתו."
```

---

## 9. System Notifications

```
note.build_done = "{building} מוכן! חזק וברוך."
note.no_wood = "אין מספיק עץ, אחי."
note.no_stone = "חסרות אבנים. יש הר שלם — צריך רק ידיים."
note.no_shekels = "הכיס ריק. אולי משלוח גבינות לצומת?"
note.water_low = "המים אוזלים! ג'ריקנים למעיין, מהר."
note.food_low = "האוכל נגמר... רעבים עובדים לאט ועצובים מהר."
note.pop_cap = "אין מקום לינה. עוד קרוואן — ויעלו עוד חברים."
note.spirit_low = "הרוח נמוכה... העבודה נגררת. אולי קומזיץ הערב?"
note.spirit_high = "הרוח בשמיים! כולם עובדים כמו מלאכים ושרים תוך כדי."
note.spirit_full = "מד הרוח מלא! זה הרגע לדברים גדולים."
note.newcomer = "{name} הצטרף/ה לגבעה! עוד זוג ידיים, עוד קול במדורה."
note.injured = "{name} נפצע — מתאושש ליד המדורה. עד הבוקר יהיה חדש."
note.recovered = "{name} חזר לאיתנו! ('מה פספסתי?')"
note.sheep_named = "כבשה חדשה בעדר. נריה קרא לה {name}. אל תשאל למה."
note.wave_incoming = "משהו מתקרב מ{dir} — הכלבים כבר הבינו. יש בערך דקה."
note.wave_cleared = "נגמר. הם ברחו, הגבעה שלמה. נשימה, ספירה, תה מרווה."
note.building_damaged = "{building} ניזוק! שווה לתקן לפני הלילה."
note.building_lost = "{building} נהרס... החומרים חלקית ניתנים לאיסוף. בונים מחדש."
note.milk_ready = "החליבה הסתיימה — יש חלב! תהילה כבר מחממת את המחלבה."
note.harvest_ready = "היבול בשל! ידיים לערוגות לפני שהחזירים מגלים לבד."
note.junction_return = "הטרמפיסט חזר מהצומת עם {n} שקלים ושתי שמועות."
note.junction_delay = "אין טרמפים בגשם... המשלוח לצומת מתעכב. סבלנות."
note.dog_hungry = "{name} רעב. כלב רעב שומר פחות טוב ומיילל יותר."
note.shabbat_locked = "שבת. הפקודה תחכה לצאת הכוכבים."
note.friday_rush = "שקיעה בעוד שעתיים! מה שלא ייגמר עד שבת — יעמוד חצי בנוי כל השבת."
note.terrace_restored = "שיקמתם טרסה עתיקה! האבנים חזרו למקום אחרי אלפיים שנה. מקום לערוגה חדשה."
note.cistern_found = "מצאתם בור מים עתיק על הגבעה! ניקוי קצר — ויש מאגר לגשם."
```

---

## 10. Loading-Screen / Idle Tips (30)

Mix: 60% mechanics coaching in-voice, 40% pure flavor. Shown on loads and long idles.

```
tip.1 = "כבשה עם שם שומרים עליה יותר. תעביר עכבר על העדר — תכיר את כולן."
tip.2 = "בונים ביום ראשון, לא ביום חמישי — מבנה שנגמר לפני שבת מספיק לעבוד."
tip.3 = "הכלבים מריחים צרות דקה לפניך. כשהם נובחים לכיוון אחד — תסתכל לשם."
tip.4 = "זאבים באים לכבשים, חזירים לערוגות, גנבים למחסן. כל אחד והתחביב שלו."
tip.5 = "רוח נמוכה? מדורה, גיטרה, ומוצאי שבת. אין בעיה שקומזיץ לא פותר חצי ממנה."
tip.6 = "המעיין נותן כמה שהוא נותן. מגדל מים ובור עתיק — זה הביטוח שלך לקיץ."
tip.7 = "החמור לא ממהר. גם אתה לא צריך — תכנון טוב שווה יותר מריצה מהירה."
tip.8 = "פעמון הגבעה מציל חיים: כבשים לדיר, ילדים לקרוואן, כולם לעמדות. אל תתבייש להשתמש."
tip.9 = "גדר לא עוצרת זאב — אבל היא קונה לך את הדקה שבה הכלב מגיע."
tip.10 = "שומר עייף נרדם. תחלק שמירות, ותשאיר תרמוס קפה ליד המגדל."
tip.11 = "אין ייאוש בעולם כלל — גם כשהחזירים הפכו הכול, שותלים מחדש בבוקר."
tip.12 = "בשבת שומרים תמיד — פיקוח נפש. מה שלא עושים בשבת: לבנות, לקטוף, לתקן."
tip.13 = "הגנרטור אוהב שלוש דברים: סולר, בעיטה בזמן, ושמישהו יגיד עליו מילה טובה."
tip.14 = "רעולי פנים בורחים כשקשה להם. אור, רעש, כלבים ואנשים — והם נעלמים."
tip.15 = "טרסה עתיקה זה לא סתם ערימת אבנים — שקם אותה ותקבל אדמה ישרה לערוגה."
tip.16 = "מהסולם של מגדל המים יש קליטה. ככה מזעיקים תומכים כשמגיע נייר מהמנהל."
tip.17 = "טלה יתום שגדל על בקבוק בטוח שהוא בן אדם. תן לו להסתובב — כולם מחייכים לידו."
tip.18 = "יום שישי זה יום התכנון: ממלאים ג'ריקנים, סופרים עדר, סוגרים גדרות — ואז נחים באמת."
tip.19 = "שני כיווני התקפה זה פי שלושה בלגן. תפזר שומרים, אל תערום הכול בשער אחד."
tip.20 = "העז עם הפעמון מובילה את העדר. איפה שהיא — שם כולן."
tip.21 = "ריח גשם ראשון (יורה) שווה עשר נקודות רוח. אף אחד לא נשאר בפנים."
tip.22 = "משלוח גבינות לצומת = שקלים. רק תוודא שנשארו מספיק ידיים על הגבעה."
tip.23 = "כשהחצב פורח — הקיץ נגמר. תתכונן לחריש, למסיק ולגשמים."
tip.24 = "עירוניים נשברים בשירותי השדה. תן להם יומיים — אחר כך הם לא רוצים לחזור העירה."
tip.25 = "כלב רעב שומר גרוע. האכלת את סימבה היום?"
tip.26 = "פצוע מתאושש ליד המדורה עד הבוקר. אף אחד לא נשאר מאחור על הגבעה הזאת."
tip.27 = "התנים מייללים כל לילה. הם לא באים — הם רק מזכירים שהם פה. תתרגל, זה הרדיו של ההר."
tip.28 = "צו הריסה זה לא סוף העולם: או שמפרקים חכם ובונים במקום אחר, או שכל הארץ עולה לחזק."
tip.29 = "מרווה מהשיח, מים מהקומקום השחור, שלוש כפיות סוכר. ככה שורדים שמירת לילה."
tip.30 = "בסוף זה לא הגדרות ולא המגדלים ששומרים על הגבעה. זה האנשים. תשמור עליהם — והם ישמרו על הכול."
```

---

## 11. Writing Rules for Future Strings (for any dev adding text)

1. **Register:** spoken Israeli Hebrew, second person singular masculine to the player
   (standard in Israeli game UI), slang from the authenticity bank only — never invent slang.
2. **Faith phrases by rule:** plans → בעזרת השם; success → ברוך השם / חסדי השם; disaster →
   הכול לטובה or אין ייאוש בעולם כלל; praise → חזק וברוך. Use at most ONE per string.
3. **Length caps:** barks ≤ 5 words; notifications ≤ 14 words; event texts ≤ 30 words;
   chapter intros ≤ 55 words. RTL wrapping in the HUD is unforgiving.
4. **Never:** ethnic/national identification of hostile humans (they are גנבים / רעולי פנים /
   פושעים only), gore words, despair without a pivot to hope, preaching. The inspector is
   never mocked cruelly — the joke is the paperwork, not the person.
5. **Animals get personality, not cuteness overload.** The donkey is a Stoic, the dogs are
   enthusiasm incarnate, the sheep are named absurdities. One joke per string, max.
6. **Placeholders** always `{likeThis}`; the i18n layer does simple substitution, no plural
   engine — write strings that read correctly for any n ("עוד {n} ימים" works for 1 via a
   dedicated `_one` key only where truly needed: `hud.days_to_shabbat_one = "מחר שבת!"`).
7. **Key naming:** `domain.item.subitem` lowercase; barks/tips numbered from 1. Adding a
   variant = next number, never reuse. The JS object is flat: `{"ch1.title": "..."}`.

---

## 12. String Count & Integration Notes

- Total keys in this document: **~310** (3 title + 16 cast + 41 name-pools + 44 menu/HUD +
  31 chapter + 23 tutorial + 46 barks + 56 events + 60 buildings/units + 27 notifications +
  30 tips + misc).
- Ship as `src/i18n/he.js`: `export const HE = { "game.title": "רוח בגבעה", ... }` — copy
  values verbatim from this doc; this doc is the source of truth, the JS file is generated.
- All UI text renders in DOM with `dir="rtl"` (per threejs-tech research — zero WebGL text).
- Bark chips: pick random index, exclude last shown; dogs/donkey parenthetical stage
  directions render in a lighter italic style.
- Event strings pair with the telegraph system: `.warn` fires at telegraph time (60–90s out),
  `.hit` at contact, `.win`/`.loss`/`.aftermath` at resolution — matching balance-theory §7.
