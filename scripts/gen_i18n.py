# Generates src/i18n/he.json + en.json from one table (keeps key parity by construction).
# Microcopy follows /workspace/timetable-design/design-spec.md §12 (keys and wording).
import json, os
T = {}
def k(key, he, en): T[key] = (he, en)

# 12.1 days
for key, he, hs, en, es in [('sun','ראשון','א׳','Sunday','Sun'),('mon','שני','ב׳','Monday','Mon'),('tue','שלישי','ג׳','Tuesday','Tue'),('wed','רביעי','ד׳','Wednesday','Wed'),('thu','חמישי','ה׳','Thursday','Thu'),('fri','שישי','ו׳','Friday','Fri'),('sat','שבת','ש׳','Saturday','Sat')]:
    k(f'day.{key}', he, en); k(f'day.{key}.short', hs, es); k(f'day.{key}.sentence', f'יום {he}', en)
# 12.2 navigation
k('app.name','מערכת שעות','Timetable Builder')
k('nav.home','בית','Home'); k('nav.setup','הגדרה','Setup')
k('step.week','שבוע ולוחות צלצולים','Week & bell schedules'); k('step.rooms','חדרים','Rooms'); k('step.subjects','מקצועות','Subjects')
k('step.teachers','מורים','Teachers'); k('step.classes','כיתות','Classes'); k('step.planning','גיליון שיבוץ','Planning sheet')
k('step.blocks','חסמים וכללים','Blocks & rules'); k('step.validate','בדיקת תקינות','Validate'); k('step.generate','יצירת מערכת','Generate')
k('nav.timetable','מערכת השעות','Timetable'); k('nav.export','ייצוא והדפסה','Export & print'); k('nav.settings','הגדרות בית הספר','School settings')
k('nav.main','ניווט ראשי','Main navigation'); k('nav.collapse','כיווץ תפריט','Collapse menu'); k('nav.expand','הרחבת תפריט','Expand menu')
k('school.switcher','החלפת בית ספר','Switch school'); k('school.add','הוספת בית ספר','Add school'); k('school.active','בית הספר הפעיל: {{name}}','Active school: {{name}}')
k('school.newName','בית ספר חדש','New school'); k('school.list','בתי הספר במחשב זה','Schools on this computer')
k('school.addTitle','הוספת בית ספר','Add a school'); k('school.delete','מחיקת בית הספר','Delete school')
k('school.deleteConfirm','למחוק את {{name}} וכל הנתונים שלו? לאישור יש להקליד את שם בית הספר.','Delete {{name}} and all its data? Type the school name to confirm.')
k('settings.tab.details','פרטי בית הספר','School details'); k('settings.tab.week','שבוע ולוחות צלצולים','Week & bell schedules')
k('settings.tab.rules','כללי בית הספר','School rules'); k('settings.tab.prefs','העדפות שיבוץ','Scheduling preferences'); k('settings.tab.display','שפה ותצוגה','Language & display')
k('field.institutionCode','סמל מוסד (לא חובה)','Institution code (optional)')
k('constraints.hard.title','אילוצים קשיחים – תמיד נאכפים','Hard constraints: always enforced')
k('constraints.hard.badge','קשיח','Hard'); k('constraints.soft.badge','רך','Soft')
for i,(he,en) in enumerate([
  ('לאף כיתה, מורה או חדר אין שני שיעורים באותה שעה','No class, teacher or room has two lessons at the same time'),
  ('כל קבוצת לימוד מקבלת בדיוק את השעות השבועיות שלה ואת מספר הכפולים שלה','Every study group gets exactly its weekly hours, and exactly its doubles'),
  ('שיעורים כפולים רק בשעות שניתן לחבר, ולא ארוכים מהאורך המרבי','Doubles only on joinable slot pairs, never longer than the max joined length'),
  ('שיעורים רק בשעות לימוד; שעה אפס רק אם מותר','Lessons only in lesson slots; zero hour only if allowed'),
  ('מורים מלמדים רק את המקצועות שלהם, ולעולם לא ביום החופשי','Teachers only teach their subjects, never on their day off'),
  ('מורים לא עוברים את המקסימום השבועי (X) ואת המקסימום היומי','Teachers stay within their weekly max (X) and daily max'),
  ('החדרים תואמים לסוג או לחדר הנדרש, פנויים ולא חסומים','Rooms match the required type or room, are free and not hard-blocked'),
  ('חסמים קשיחים של מורים, כיתות, חדרים, שכבות ובית הספר נשמרים','Hard blocks on teachers, classes, rooms, grades and the school are respected')]):
    k(f'constraints.hard.{i+1}', he, en)
k('constraints.hard.note','(הערכים של מקסימום יומי, אורך שיעור כפול ושעה אפס נערכים ב״כללי בית הספר״)','(daily max / joined length / zero hour values are edited in "School rules")')
k('prefs.title','העדפות שיבוץ','Scheduling preferences')
for key,he,en,hh,eh in [
  ('avoidTeacherGaps','צמצום חלונות למורים','Avoid teacher gaps','פחות שעות פנויות בין שיעורים של אותו מורה באותו יום.','Fewer free periods between a teacher\'s lessons on the same day.'),
  ('compactClassDays','ימים רציפים לכיתות','Compact class days','הכיתות מתחילות בשעת הלימוד הרגילה הראשונה, בלי שעות פנויות באמצע.','Classes start at the first regular lesson with no free slots in between.'),
  ('spreadSubjects','פיזור מקצועות לאורך השבוע','Spread subjects across the week','עד שעתיים מאותו מקצוע ביום. שיעור כפול נחשב מפגש אחד.','At most 2 hours of a subject per day. A double counts as one session.'),
  ('balanceTeacherLoad','איזון העומס של המורים','Balance teacher load','חלוקה שווה של שעות המורה בין ימי העבודה.','Spread each teacher\'s hours evenly across working days.'),
  ('respectSoftBlocks','הימנעות מחסמים רכים','Avoid soft blocks','המערכת תשתדל לא לשבץ שיעורים בשעות שסומנו כחסם רך.','Try not to place lessons in slots marked as soft blocks.')]:
    k(f'prefs.{key}',he,en); k(f'prefs.{key}.help',hh,eh)
k('prefs.active','העדפות פעילות:','Active preferences:')
k('rules.title','כללי בית הספר','School rules')
k('rules.maxTeacherDailyHours','מקסימום שעות הוראה ביום למורה','Max teaching hours per teacher per day')
k('rules.maxTeacherDailyHours.help','אפשר לקבוע מקסימום אישי בכרטיס המורה.','A teacher can have a personal cap in their card.')
k('rules.maxJoinedLessonMinutes','אורך מרבי לשיעור כפול (דק׳)','Max length of a double lesson (min)')
k('rules.allowZeroHour','אפשר שעה אפס','Allow zero hour'); k('rules.saved','הכלל עודכן','Rule updated')
k('prefs.note','העדפות משפרות את המערכת, אבל אף פעם לא גוברות על אילוץ קשיח.','Preferences improve the timetable but never override a hard constraint.')
k('prefs.restore','שחזור ברירות המחדל','Restore defaults')
k('prefs.changed','ההעדפות השתנו. כדי להחיל אותן יש ליצור מערכת מחדש.','Preferences changed. Generate again to apply them.')
k('prefs.softBlocksOff','ההעדפה כבויה, והמערכת מתעלמת מחסמים רכים','The preference is off, so soft blocks are ignored')
k('nav.help','עזרה','Help'); k('nav.skip','דילוג לתוכן הראשי','Skip to main content')
k('stepper.label','שלב {{n}} מתוך {{total}}: {{name}}','Step {{n}} of {{total}}: {{name}}')
k('stepper.locked','יש לתקן את השגיאות החוסמות לפני היצירה','Fix blocking errors before generating')
# 12.3 actions
for key,he,en in [('next','הבא: {{step}}','Next: {{step}}'),('back','הקודם','Back'),('save','שמירה','Save'),('cancel','ביטול','Cancel'),('close','סגירה','Close'),('delete','מחיקה','Delete'),('duplicate','שכפול','Duplicate'),('edit','עריכה','Edit'),
  ('addTeacher','הוספת מורה','Add teacher'),('addRoom','הוספת חדר','Add room'),('addSubject','הוספת מקצוע','Add subject'),('addClass','הוספת כיתה','Add class'),('addGrade','הוספת שכבה שלמה','Add a whole grade'),('addGradeN','הוספת {{count}} כיתות','Add {{count}} classes'),
  ('copyRow','העתקת שורה לשכבה','Copy row to grade'),('copyToN','העתקה ל־{{count}} כיתות','Copy to {{count}} classes'),('addRoomType','הוספת סוג חדר','Add room type'),('addBlock','חסם חדש','New block'),('wholeDay','כל היום','Whole day'),
  ('addLessonSlot','שעת לימוד','Lesson slot'),('addBreak','הפסקה','Break'),('addZeroHour','שעה אפס','Zero hour'),('generateFromPattern','יצירה מתבנית…','Generate from pattern…'),('replaceSlots','החלפת השעות','Replace slots'),('create','יצירה','Create'),
  ('newSchedule','לוח צלצולים חדש','New bell schedule'),('deleteGroup','מחיקת הקבוצה','Delete group'),('sample','טעינת בית ספר לדוגמה','Load sample school'),('sampleLarge','טעינת בית ספר גדול לדוגמה (24 כיתות)','Load large sample school (24 classes)'),
  ('startSetup','התחלת ההגדרה','Start setup'),('validate','בדיקה חוזרת','Re-check'),('fix','תיקון','Fix'),('ignore','התעלמות','Ignore'),('show','הצגה במערכת','Show in timetable'),
  ('generate','יצירת מערכת','Generate timetable'),('regenerate','יצירה מחדש','Generate again'),('stop','עצירה','Stop'),('viewTimetable','צפייה במערכת','View timetable'),('undo','ביטול פעולה','Undo'),('redo','חזרה על פעולה','Redo'),
  ('print','הדפסה','Print'),('printN','הדפסת {{count}} עמודים','Print {{count}} pages'),('exportJson','ייצוא קובץ פרויקט (JSON)','Export project file (JSON)'),('importJson','ייבוא קובץ פרויקט','Import project file'),
  ('retry','ניסיון חוזר','Try again'),('selectAll','בחירת הכול','Select all'),('clear','ניקוי','Clear'),('accept','אישור המערכת','Accept timetable'),('discard','מחיקת הטיוטה','Discard draft'),('previous','הקודם','Previous'),('nextItem','הבא','Next'),('open','פתיחה','Open'),('rename','שינוי שם','Rename'),('tryLonger','ניסיון חוזר עם {{min}} דקות','Try again with {{min}} minutes')]:
    k(f'action.{key}',he,en)
k('blocks.brush.hard','קשיח','Hard'); k('blocks.brush.soft','רך','Soft'); k('blocks.brush.erase','מחיקה','Erase'); k('blocks.brush','מכחול:','Brush:')
# 12.4 labels
for key,he,en in [('schoolName','שם בית הספר','School name'),('schoolYear','שנת לימודים','School year'),('schoolDays','ימי לימודים','Teaching days'),('template','תבנית שבוע','Week template'),
  ('start','שעת התחלה','Start time'),('end','שעת סיום','End time'),('subjectName','שם המקצוע','Subject name'),('abbrev','קיצור','Abbreviation'),('color','צבע','Colour'),('ministryCode','קוד משרד החינוך (לא חובה)','Ministry code (optional)'),
  ('roomName','שם החדר','Room name'),('roomType','סוג חדר','Room type'),('capacity','קיבולת (לא חובה)','Capacity (optional)'),('defaultRoom','חדר ברירת מחדל','Default room'),('roomOverride','חדר לקבוצה','Room for this group'),
  ('teacherName','שם המורה','Teacher name'),('maxWeeklyHours','מקסימום שעות שבועיות (ש״ש)','Maximum weekly hours'),('classWeeklyHours','שעות שבועיות','Weekly hours'),('possiblePeriods','שעות אפשריות','Possible hours'),
  ('maxDailyHours','מקסימום שעות ביום','Max hours per day'),('subjectsTaught','מקצועות הוראה','Subjects taught'),('dayOff','יום חופשי','Day off'),('className','כיתה','Class'),('grade','שכבה','Grade'),('parallel','מקבילה','Parallel no.'),
  ('displayName','שם תצוגה','Display name'),('homeroomRoom','כיתת אם','Homeroom'),('homeroomTeacher','מחנך הכיתה','Homeroom teacher'),('name','שם','Name'),('status','מצב','Status'),('assigned','שובצו','Assigned'),('actions','פעולות','Actions'),('timeLimit','מגבלת זמן','Time limit'),('language','שפה','Language'),('density','צפיפות','Density')]:
    k(f'field.{key}',he,en)
k('field.maxWeeklyHours.help','המורה ילמד עד מספר השעות הזה, לא בהכרח בדיוק.','The teacher teaches up to this many hours, not necessarily exactly.')
k('field.maxDailyHours.placeholder','ברירת מחדל של בית הספר: {{n}}','School default: {{n}}')
k('field.dayOff.required','יש לבחור יום חופשי','Choose a day off')
k('field.subjects.required','יש לבחור לפחות מקצוע אחד','Choose at least one subject')
k('template.sunThu','א׳–ה׳','Sun–Thu'); k('template.sunFriShort','א׳–ו׳, שישי קצר','Sun–Fri, short Friday')
k('bell.schedule','לוח צלצולים','Bell schedule'); k('bell.forDay','לוח צלצולים ליום {{day}}','Bell schedule for {{day}}'); k('bell.usedBy','בשימוש: {{days}}','Used by: {{days}}')
k('bell.unused','לא משויך לאף יום','Not used by any day')
k('bell.slot.lesson','שעה {{n}}','Period {{n}}'); k('bell.slot.break','הפסקה','Break'); k('bell.slot.zero','שעה אפס','Zero hour')
k('bell.type','סוג','Type'); k('bell.type.lesson','שיעור','Lesson'); k('bell.type.break','הפסקה','Break'); k('bell.slot','שעה','Slot')
k('bell.length','אורך (דק׳)','Length (min)'); k('bell.joinable','ניתן לחיבור עם הבאה','Joinable with next'); k('bell.joinableAcrossBreak','חיבור דרך הפסקה','Join across break')
k('bell.joinTooLong','{{min}} דקות · המקסימום {{max}}','{{min}} min · max {{max}}')
k('bell.pattern.title','יצירת שעות מתבנית','Generate slots from a pattern'); k('bell.pattern.firstStart','תחילת השיעור הראשון','First lesson starts')
k('bell.pattern.lessonLength','אורך שיעור (דק׳)','Lesson length (min)'); k('bell.pattern.lessons','מספר שיעורים','Number of lessons')
k('bell.pattern.breakAfter','הפסקה אחרי שיעור {{n}}, באורך {{min}} דק׳','Break after lesson {{n}}, {{min}} min')
k('bell.pattern.breakAfterLabel','הפסקה אחרי שיעור','Break after lesson'); k('bell.pattern.breakLength','אורך (דק׳)','Length (min)'); k('bell.pattern.addBreak','הוספת הפסקה','Add break')
k('bell.pattern.pairs','זוגות לחיבור','Joinable pairs'); k('bell.pattern.pairs.all','1–2, 3–4, 5–6…','1–2, 3–4, 5–6…'); k('bell.pattern.pairs.none','ללא','None')
k('bell.pattern.replaceWarn','הפעולה מחליפה את {{count}} השעות בלוח ״{{name}}״.','This replaces the {{count}} slots in "{{name}}".')
k('bell.pattern.preview','{{count}} שיעורים · מסתיים ב־{{end}}','{{count}} lessons · ends {{end}}')
k('bell.deleteBlocked','יש לשייך את {{day}} ללוח אחר לפני המחיקה','Assign {{day}} to another schedule before deleting')
k('bell.summary','{{count}} שעות לימוד · {{start}}–{{end}}','{{count}} lesson slots · {{start}}–{{end}}')
k('bell.dayAssignment','שיוך לוחות צלצולים לימים','Bell schedule per day'); k('bell.name','שם הלוח','Schedule name'); k('bell.newName','לוח {{n}}','Schedule {{n}}')
k('bell.zeroOff','שעה אפס מוגדרת, אבל הכלל ״אפשר שעה אפס״ כבוי.','A zero hour is defined, but "Allow zero hour" is off.')
k('week.templateApply','החלת תבנית','Apply template'); k('week.templateWarn','החלת תבנית מחליפה את כל לוחות הצלצולים.','Applying a template replaces all bell schedules.')
k('grid.break','הפסקה','Break'); k('grid.breakMin','הפסקה {{min}}′','Break {{min}}′'); k('grid.double','שיעור כפול','Double lesson'); k('grid.period','שעה','Period')
k('roomType.suggestions','הצעות: כיתה, מעבדת מדעים, חדר מחשבים, אולם ספורט…','Suggestions: classroom, science lab, computer room, gym…')
k('roomType.title','סוגי חדרים','Room types'); k('rooms.title','חדרים','Rooms'); k('rooms.count','{{count}} חדרים','{{count}} rooms')
k('defaultRoom.homeroom','כיתת אם','Homeroom'); k('defaultRoom.type','סוג חדר','Room type'); k('defaultRoom.none','ללא חדר','No room')
k('roomOverride.subjectDefault','ברירת המחדל של המקצוע','Subject default'); k('roomOverride.specific','חדר מסוים','Specific room')
k('blocks.title','חסמים','Blocks'); k('blocks.hard','חסם קשיח','Hard block'); k('blocks.soft','חסם רך','Soft block')
for key,he,en in [('teacher','מורה','Teacher'),('class','כיתה','Class'),('room','חדר','Room'),('grade','שכבה','Grade'),('school','בית הספר כולו','Whole school')]:
    k(f'blocks.scope.{key}',he,en)
k('blocks.note','הערה (לא חובה)','Note (optional)'); k('blocks.target','יעד','Target')
k('blocks.inherited','חסם של {{target}} · עריכה במסך {{scope}}','Block from {{target}} · edit in {{scope}}')
k('blocks.summary','{{hard}} שעות חסומות (קשיח), {{soft}} (רך)','{{hard}} hard-blocked slots, {{soft}} soft')
k('blocks.orphan','החסם ״{{note}}״ מפנה ל{{when}} שהוסר','Block "{{note}}" points to removed {{when}}')
k('blocks.autoTitle','חסם {{n}}','Block {{n}}'); k('blocks.empty','אין חסמים. ״חסם חדש״ יוצר חסם, ואז אפשר לסמן שעות בטבלה.','No blocks. "New block" creates one, then mark slots in the grid.')
k('blocks.painting','צובעים לתוך: ״{{name}}״','Painting into: "{{name}}"'); k('blocks.pickTarget','יש לבחור יעד','Choose a target')
k('blocks.noSlot','אין שעה זו','No such slot'); k('blocks.wholeDayLabel','כל היום · {{hardness}}','Whole day · {{hardness}}')
k('blocks.when.day','{{day}} כל היום','{{day}} all day'); k('blocks.when.slots','{{day}} שעות {{periods}}','{{day}} periods {{periods}}')
k('blocks.helpGrid','לחיצה על תא מוסיפה או מסירה אותו מהחסם הפעיל. ״כל היום״ מעל עמודה חוסם את היום כולו.','Click a cell to add or remove it from the active block. "Whole day" above a column blocks the entire day.')
k('state.noSchool','אין לימודים','No school')
k('field.maxWeeklyHours.short','X','X')
k('teacher.assigned','{{assigned}} / {{max}}','{{assigned}} / {{max}}')
k('teacher.capacity','{{days}} ימי עבודה × {{cap}} ביום = {{total}}','{{days}} working days × {{cap}}/day = {{total}}')
k('teacher.workDays','ימי עבודה: {{days}} · עד {{cap}} שעות ביום · {{total}} שעות אפשריות','Working days: {{days}} · up to {{cap}} h/day · {{total}} possible hours')
k('teacher.overCapacity','שובצו {{assigned}} שעות אך אפשריות רק {{total}}','{{assigned}} hours assigned but only {{total}} possible')
k('teacher.full','(מלא)','(full)'); k('teacher.dailyHours','שעות ביום','Hours per day'); k('teacher.gaps','חלונות: {{count}}','Gaps: {{count}}')
k('teacher.hoursOfMax','{{assigned}} מתוך {{max}} ש״ש','{{assigned}} of {{max}} weekly hours')
k('teacher.blocksHint','חסמים של מורה (ישיבות, אילוצים) נערכים במסך ״חסמים וכללים״.','Teacher blocks (meetings, constraints) are edited on the "Blocks & rules" screen.')
k('grade.addTitle','הוספת שכבה שלמה','Add a whole grade'); k('grade.parallels','מקבילות: מ־ עד','Parallels: from, to'); k('grade.from','ממקבילה','From')
k('grade.to','עד מקבילה','To'); k('grade.autoHomerooms','שיוך אוטומטי של כיתות פנויות','Assign free classrooms automatically')
k('grade.copyGroups','העתקת שורת גיליון השיבוץ של {{class}}','Copy the planning-sheet row of {{class}}')
k('grade.7','ז׳','7th'); k('grade.8','ח׳','8th'); k('grade.9','ט׳','9th'); k('grade.label','שכבה {{grade}} ({{count}})','Grade {{grade}} ({{count}})')
k('group.auto','אוטומטי','Auto'); k('group.autoAssigned','שובץ אוטומטית: {{name}}','Auto-assigned: {{name}}'); k('group.pin','קיבוע','Fix'); k('group.pinTitle','קיבוע {{name}} כמורה הקבוע','Fix {{name}} as the teacher')
k('group.title','קבוצת לימוד','Study group'); k('group.teacher','מורה','Teacher'); k('group.weeklyHours','שעות שבועיות','Weekly hours'); k('group.doubles','שיעורים כפולים','Doubles')
k('group.doubles.help','שיעור כפול = 2 שעות רצופות שניתן לחבר (לפי לוח הצלצולים)','A double = 2 consecutive joinable slots (per the bell schedule)')
k('group.doublesMax','מקסימום {{max}}','max {{max}}'); k('group.doublesClamped','מספר הכפולים הותאם ל־{{n}}','Doubles adjusted to {{n}}')
k('group.noTeacher','חסר מורה','No teacher'); k('group.showUnqualified','הצגת מורים שאינם מלמדים מקצוע זה','Show teachers who don\'t teach this subject')
k('group.unqualified','לא מלמד/ת','not qualified'); k('group.dialogTitle','{{subject}} · {{class}}','{{subject}} · {{class}}')
k('group.impactTeacher','{{name}}: {{before}} → {{after}} מתוך {{max}}','{{name}}: {{before}} → {{after}} of {{max}}')
k('group.impactClass','{{name}}: {{before}} → {{after}} מתוך {{slots}}','{{name}}: {{before}} → {{after}} of {{slots}}')
k('group.pickTeacher','בחירת מורה…','Choose a teacher…'); k('group.addSubjectToTeacher','הוספת {{subject}} למקצועות של {{teacher}}','Add {{subject}} to {{teacher}}\'s subjects')
k('planning.title','גיליון שיבוץ','Planning sheet'); k('planning.total','סה״כ','Total'); k('planning.teacherLoad','עומס מורים','Teacher load'); k('planning.empty','ללא קבוצה','No group')
k('planning.slots','{{hours}} מתוך {{slots}}','{{hours}} of {{slots}}'); k('planning.groups','קבוצות','groups'); k('planning.hoursShort','ש׳','h')
k('planning.help','כל תא הוא קבוצת לימוד: מורה, שעות שבועיות וכפולים. לחיצה על תא פותחת את העורך.','Each cell is a study group: teacher, weekly hours and doubles. Click a cell to edit it.')
k('planning.grandTotal','{{hours}} שעות · {{groups}} קבוצות','{{hours}} hours · {{groups}} groups')
k('planning.clearHighlight','ניקוי הדגשה','Clear highlight')
k('common.of','{{a}} מתוך {{b}}','{{a}} of {{b}}')
k('common.hours_one','שעה אחת','1 hour'); k('common.hours_two','שעתיים','2 hours'); k('common.hours_many','{{count}} שעות','{{count}} hours'); k('common.hours_other','{{count}} שעות','{{count}} hours')
k('common.optional','(לא חובה)','(optional)'); k('common.none','—','—'); k('common.yes','כן','Yes'); k('common.no','לא','No'); k('common.weeklyHoursShort','ש״ש','h/wk')
k('common.minutes','{{count}} דק׳','{{count}} min'); k('common.seconds','{{count}} שנ׳','{{count}} s')
k('view.class','כיתה','Class'); k('view.teacher','מורה','Teacher'); k('view.room','חדר','Room'); k('view.density','צפיפות: רגיל / צפוף','Density: Normal / Compact')
k('view.density.normal','רגיל','Normal'); k('view.density.compact','צפוף','Compact'); k('view.showing','מוצגת: {{which}}','Showing: {{which}}')
k('legend.title','מקרא','Legend'); k('legend.hatch','אין לימודים','No school'); k('legend.double','שיעור כפול','Double lesson'); k('legend.dayOff','יום חופשי','Day off')
k('print.draftWarning','טיוטה – קיימות התנגשויות','Draft: has conflicts'); k('print.footer','הודפס {{date}} · עמוד {{p}} מתוך {{n}}','Printed {{date}} · page {{p}} of {{n}}')
k('print.title','{{school}} · מערכת שעות · {{entity}}','{{school}} · Timetable · {{entity}}'); k('print.what','מה להדפיס','What to print'); k('print.type','סוג','Type')
k('print.all','הכול ({{count}})','All ({{count}})'); k('print.pdfHint','לשמירה כ‑PDF יש לבחור ״שמירה כ‑PDF״ בחלון ההדפסה','To save as PDF, choose "Save as PDF" in the print dialog')
k('print.options','אפשרויות','Options'); k('print.colour','צבע (כבוי = גווני אפור)','Colour (off = grayscale)'); k('print.legend','כולל מקרא','Include legend'); k('print.pages','עמוד לכל {{what}} · {{count}} עמודים','One page per {{what}} · {{count}} pages')
k('print.current','הדפסת התצוגה הנוכחית','Print the current view')
# 12.5 statuses
k('severity.error','שגיאה חוסמת','Blocking error'); k('severity.warning','אזהרה','Warning'); k('severity.info','הערה','Note'); k('severity.success','תקין','OK')
for key,one,two,other,e1,e2,eo in [('errors','שגיאה אחת','שתי שגיאות','{{count}} שגיאות','1 error','2 errors','{{count}} errors'),('warnings','אזהרה אחת','שתי אזהרות','{{count}} אזהרות','1 warning','2 warnings','{{count}} warnings'),('notes','הערה אחת','שתי הערות','{{count}} הערות','1 note','2 notes','{{count}} notes'),('conflicts','התנגשות אחת','שתי התנגשויות','{{count}} התנגשויות','1 conflict','2 conflicts','{{count}} conflicts')]:
    k(f'count.{key}_one',one,e1); k(f'count.{key}_two',two,e2); k(f'count.{key}_many',other,eo); k(f'count.{key}_other',other,eo)
k('save.saved','כל השינויים נשמרו','All changes saved'); k('save.saving','שומר…','Saving…'); k('save.failed','השמירה נכשלה','Couldn\'t save')
k('project.draft','טיוטה','Draft'); k('project.ready','מוכן ליצירה','Ready to generate'); k('project.valid','מערכת תקינה','Timetable valid'); k('project.hasErrors','יש שגיאות','Has errors')
k('timetable.status.draft','טיוטה','Draft'); k('timetable.status.accepted','מאושרת','Accepted')
k('timetable.caption','מערכת שעות – {{entity}} · {{hours}} שעות','Timetable – {{entity}} · {{hours}} hours')
k('timetable.none','עוד לא נוצרה מערכת שעות.','No timetable has been generated yet.'); k('timetable.showDraft','טיוטה חדשה','New draft'); k('timetable.showAccepted','המערכת המאושרת','Accepted timetable')
k('timetable.classSummary','{{placed}} מתוך {{required}} שעות · כיתת אם: {{room}} · מחנך: {{teacher}}','{{placed}} of {{required}} hours · Homeroom: {{room}} · Homeroom teacher: {{teacher}}')
k('timetable.roomSummary','ניצולת: {{used}} מתוך {{total}}','Utilisation: {{used}} of {{total}}')
k('timetable.dayOffShort','חופשי','off')
k('action.compare','השוואה למערכת הנוכחית','Compare with current'); k('confirm.accept','המערכת החדשה תחליף את המערכת הנוכחית. אפשר לחזור אחורה עם ביטול פעולה.','The new timetable will replace the current one. You can go back with Undo.')
k('quality.title','דוח איכות','Quality report'); k('quality.first','(פתרון תקין ראשון: {{count}})','(first valid solution: {{count}})')
k('quality.metric.avoidTeacherGaps','חלונות למורים','Teacher gaps'); k('quality.metric.compactClassDays','חלונות / איחור בכיתות','Class gaps / late start'); k('quality.metric.spreadSubjects','מקצוע מעל שעתיים ביום','Subject over 2 h/day')
k('quality.metric.balanceTeacherLoad','סטייה מעומס יומי ממוצע','Deviation from average daily load'); k('quality.metric.respectSoftBlocks','שיעורים בחסמים רכים','Lessons in soft blocks')
k('quality.affected','מושפעים:','Affected:'); k('quality.off','כבוי','off')
k('quality.gaps_one','חלון אחד','1 gap'); k('quality.gaps_two','שני חלונות','2 gaps'); k('quality.gaps_many','{{count}} חלונות','{{count}} gaps'); k('quality.gaps_other','{{count}} חלונות','{{count}} gaps')
k('gen.impossible','אין מערכת אפשרית עם הנתונים הנוכחיים','No valid timetable exists with the current data')
k('gen.notFound','לא נמצאה מערכת בתוך {{min}} דקות. זה לא אומר שאין פתרון.','No timetable found within {{min}} minutes. That doesn\'t mean there\'s no solution.')
k('gen.bestSoFar','נעצר במגבלת הזמן. זו המערכת התקינה הטובה ביותר שנמצאה.','Stopped at the time limit. This is the best valid timetable found.')
k('gen.cancelled','היצירה נעצרה. זו המערכת התקינה הטובה ביותר שנמצאה עד כה.','Generation stopped. This is the best valid timetable found so far.')
k('validate.blocked','אי אפשר ליצור מערכת עד שיתוקנו {{count}} שגיאות חוסמות.','Generation is blocked until {{count}} errors are fixed.')
k('validate.allGood','הכול תקין. אפשר ליצור מערכת.','Everything checks out. Ready to generate.')
k('validate.ignored','התעלמת מ־{{count}}','Ignored ({{count}})'); k('validate.title','בדיקת תקינות','Validation')
k('gen.phase1','בדיקת נתונים','Checking data'); k('gen.phase2','שיבוץ שיעורים','Placing lessons'); k('gen.phase3','שיפור המערכת (צמצום חלונות)','Improving (fewer gaps)')
k('gen.progress','שובצו {{placed}} מתוך {{total}} שיעורים','Placed {{placed}} of {{total}} lessons'); k('gen.success','המערכת נוצרה','Timetable created')
k('gen.slow','זה לוקח יותר זמן מהרגיל. אפשר להמשיך לעבוד, נודיע כשיסתיים.','This is taking longer than usual. Keep working and we\'ll let you know.')
k('gen.running','יוצרים מערכת שעות…','Generating timetable…'); k('gen.elapsed','{{time}} חלפו','{{time}} elapsed'); k('gen.score','ציון נוכחי: {{score}}','Current score: {{score}}')
k('gen.readySummary','{{classes}} כיתות · {{groups}} קבוצות לימוד · {{teachers}} מורים · {{hours}} שעות לשיבוץ','{{classes}} classes · {{groups}} study groups · {{teachers}} teachers · {{hours}} hours to place')
k('gen.setupValid','ההגדרה תקינה','Setup is valid'); k('gen.roomsAuto','החדרים משובצים אוטומטית.','Rooms are assigned automatically.')
k('gen.newReady','מערכת חדשה מוכנה (טיוטה)','New timetable ready (draft)'); k('gen.allPlaced','שובצו {{placed}} מתוך {{total}} שיעורים · כל האילוצים הקשיחים מתקיימים','{{placed}} of {{total}} lessons placed · all hard constraints met')
k('gen.unplaced','שיעורים שלא שובצו','Unplaced lessons'); k('gen.unplacedItem','{{subject}} · {{class}} · {{count}} × {{len}}','{{subject}} · {{class}} · {{count}} × {{len}}')
k('gen.len1','שעה','single'); k('gen.len2','כפול','double')
k('gen.current','המערכת המאושרת הנוכחית: {{date}}','Current accepted timetable: {{date}}'); k('gen.keptPrevious','המערכת הקודמת נשמרה.','The previous timetable was kept.')
k('gen.accepted','המערכת החדשה אושרה','The new timetable was accepted'); k('gen.stats','{{time}} · זרע {{seed}}','{{time}} · seed {{seed}}')
k('gen.mainCause','סיבה עיקרית:','Main cause:'); k('gen.also','גם:','Also:')
k('banner.stale','נתוני ההגדרה השתנו מאז יצירת המערכת.','Setup data changed since this timetable was generated.')
k('banner.smallScreen','העריכה מותאמת למסך ברוחב 1024 פיקסלים ומעלה.','Editing works best on screens 1024 px or wider.')
k('confirm.deleteTeacher','למחוק את המורה {{name}}? {{count}} קבוצות לימוד יישארו בלי מורה.','Delete {{name}}? {{count}} study groups will be left without a teacher.')
k('confirm.deleteGeneric','למחוק את ״{{name}}״?','Delete "{{name}}"?')
k('confirm.unsaved','לסגור בלי לשמור? השינויים יאבדו.','Close without saving? Your changes will be lost.')
k('onboarding.title','בואו נבנה את מערכת השעות לשנה הזו','Let\'s build this year\'s timetable')
k('onboarding.body','מזינים את נתוני בית הספר שלב אחר שלב, בודקים ויוצרים מערכת בתוך דקות. הכול נשמר אוטומטית.','Enter your school\'s data step by step, check it, and generate a timetable in minutes. Everything saves automatically.')
k('home.progress','התקדמות ההגדרה','Setup progress'); k('home.stepDone','הושלם','Done'); k('home.stepTodo','עוד לא','Not yet'); k('home.localOnly','הנתונים נשמרים בדפדפן במחשב זה בלבד. לגיבוי: ייצוא קובץ פרויקט.','Data is stored in this browser only. To back up: export the project file.')
k('empty.teachers.title','עוד לא נוספו מורים','No teachers yet')
k('empty.teachers.body','צריך מורים כדי למלא את גיליון השיבוץ. אפשר להוסיף אחד־אחד.','You need teachers to fill the planning sheet. Add them one by one.')
k('empty.generic','אין עדיין פריטים.','Nothing here yet.'); k('empty.search','לא נמצאו תוצאות עבור ״{{q}}״','No results for "{{q}}"')
k('empty.classes','עוד לא נוספו כיתות. ״הוספת שכבה שלמה״ יוצרת את כל המקבילות בבת אחת.','No classes yet. "Add a whole grade" creates all parallels at once.')
k('empty.planning','צריך כיתות ומקצועות כדי להציג את גיליון השיבוץ.','You need classes and subjects to show the planning sheet.')
k('toast.imported','הנתונים יובאו','Data imported'); k('toast.saved','נשמר','Saved'); k('toast.prefSaved','ההעדפה נשמרה','Preference saved'); k('toast.deleted','נמחק','Deleted')
k('io.title','קובץ פרויקט','Project file'); k('io.help','קובץ JSON עם כל נתוני בית הספר (כולל גרסת סכמה). מתאים לגיבוי ולהעברה בין מחשבים.','A JSON file with all of the school\'s data (including a schema version). Use it for backup and moving between computers.')
k('io.exists','בית הספר ״{{name}}״ כבר קיים במחשב זה.','The school "{{name}}" already exists on this computer.')
k('io.replace','החלפת הקיים','Replace existing'); k('io.asCopy','ייבוא כעותק','Import as a copy')
k('io.errors.notJson','הקובץ אינו JSON תקין.','The file isn\'t valid JSON.'); k('io.errors.notProject','הקובץ אינו קובץ פרויקט של מערכת שעות.','The file isn\'t a timetable project file.')
k('io.errors.newerVersion','הקובץ נוצר בגרסה חדשה יותר ({{version}}). הגרסה הנתמכת: {{supported}}.','The file was made by a newer version ({{version}}). Supported: {{supported}}.')
k('io.errors.badField','השדה ״{{field}}״ בקובץ אינו תקין.','The field "{{field}}" in the file is invalid.'); k('io.errors.wrongSchool','רשומות ב״{{field}}״ שייכות לבית ספר אחר.','Records in "{{field}}" belong to another school.')
k('display.language','שפת הממשק','Interface language'); k('display.he','עברית','עברית'); k('display.en','English','English')
k('kind.school','בית ספר','School'); k('kind.week','שבוע','Week'); k('kind.rules','כללים','Rules'); k('kind.roomType','סוג חדר','Room type'); k('kind.room','חדר','Room'); k('kind.subject','מקצוע','Subject')
k('kind.teacher','מורה','Teacher'); k('kind.class','כיתה','Class'); k('kind.group','קבוצת לימוד','Study group'); k('kind.block','חסם','Block'); k('kind.cluster','אשכול','Cluster')
k('validate.goTo','מעבר ל{{place}}','Go to {{place}}')

# Issues (params: names are resolved; {{day}} is replaced by the day name at render time)
I = {
 'E_WEEK_NO_DAYS':('לא נבחרו ימי לימודים.','No teaching days are selected.'),
 'E_WEEK_NO_BELL_SCHEDULES':('אין לוח צלצולים.','There is no bell schedule.'),
 'E_WEEK_DAY_NO_SCHEDULE':('ליום {{day}} לא שויך לוח צלצולים.','{{day}} has no bell schedule.'),
 'E_BELL_DUPLICATE_SLOT_ID':('בלוח הצלצולים ״{{schedule}}״: מזהה כפול בשורה {{slot}}.','Bell schedule "{{schedule}}": duplicate id in row {{slot}}.'),
 'E_BELL_BAD_TIME':('בלוח הצלצולים ״{{schedule}}״: שעה לא תקינה בשורה {{slot}}.','Bell schedule "{{schedule}}": invalid time in row {{slot}}.'),
 'E_BELL_END_BEFORE_START':('בלוח הצלצולים ״{{schedule}}״: בשורה {{slot}} שעת הסיום ({{end}}) אינה אחרי שעת ההתחלה ({{start}}).','Bell schedule "{{schedule}}": row {{slot}} ends ({{end}}) before it starts ({{start}}).'),
 'E_BELL_OVERLAP':('בלוח הצלצולים ״{{schedule}}״: שורה {{slot}} מתחילה ({{start}}) לפני שהקודמת מסתיימת.','Bell schedule "{{schedule}}": row {{slot}} starts ({{start}}) before the previous one ends.'),
 'E_BELL_NO_LESSON_SLOTS':('בלוח הצלצולים ״{{schedule}}״ אין שעות לימוד.','Bell schedule "{{schedule}}" has no lesson slots.'),
 'E_BELL_JOIN_NO_NEXT':('בלוח הצלצולים ״{{schedule}}״: שעה {{period}} מסומנת לחיבור, אבל אין אחריה שעת לימוד.','Bell schedule "{{schedule}}": period {{period}} is joinable but no lesson follows it.'),
 'E_BELL_JOIN_TOO_LONG':('בלוח הצלצולים ״{{schedule}}״: חיבור שעות {{period}}–{{next}} נמשך {{minutes}} דקות, יותר מהמקסימום ({{max}}).','Bell schedule "{{schedule}}": joining periods {{period}}–{{next}} takes {{minutes}} min, more than the max ({{max}}).'),
 'E_GROUP_UNKNOWN_SUBJECT':('לקבוצה ב־{{class}} אין מקצוע תקין.','A group in {{class}} has no valid subject.'),
 'E_GROUP_NO_TEACHER':('ל{{subject}} ב־{{class}} לא נבחר מורה.','{{subject}} in {{class}} has no teacher.'),
 'E_GROUP_NO_CLASS':('לקבוצת {{subject}} לא שויכה כיתה.','The {{subject}} group has no class.'),
 'E_GROUP_UNKNOWN_REFERENCE':('הקבוצה {{subject}} ב־{{class}} מפנה למורה או לכיתה שנמחקו.','The {{subject}} group in {{class}} points to a deleted teacher or class.'),
 'E_GROUP_HOURS_INVALID':('ל{{subject}} ב־{{class}} מספר שעות לא תקין ({{hours}}).','{{subject}} in {{class}} has an invalid number of hours ({{hours}}).'),
 'E_GROUP_DOUBLES_INVALID':('ל{{subject}} ב־{{class}} הוגדרו {{doubles}} כפולים, אבל יש רק {{hours}} שעות.','{{subject}} in {{class}}: {{doubles}} doubles, but only {{hours}} hours.'),
 'E_GROUP_TEACHER_NOT_QUALIFIED':('המקצוע {{subject}} ב־{{class}} שובץ למורה {{teacher}}, אבל אינו מופיע ברשימת המקצועות של המורה.','{{teacher}} teaches {{subject}} in {{class}} but isn\'t qualified for it.'),
 'E_CLASS_NO_HOMEROOM':('לכיתה {{class}} לא הוגדרה כיתת אם, ו{{subject}} נלמד בכיתת האם.','{{class}} has no homeroom, but {{subject}} is taught in the homeroom.'),
 'E_GROUP_NO_MATCHING_ROOM':('ל{{subject}} ב־{{class}} נדרש חדר ״{{roomType}}״, אבל אין בבית הספר חדר כזה.','{{subject}} in {{class}} needs a "{{roomType}}" room, but the school has none.'),
 'E_GROUP_NOT_ENOUGH_SLOTS':('ל{{subject}} ב־{{class}} נדרשות {{hours}} שעות, אבל למורה ולכיתה יש יחד רק {{slots}} שעות פנויות.','{{subject}} in {{class}} needs {{hours}} hours, but the teacher and class share only {{slots}} free slots.'),
 'E_GROUP_NO_JOINABLE_PAIR':('ל{{subject}} ב־{{class}} נדרשים {{doubles}} שיעורים כפולים, אבל בימי העבודה של {{teacher}} אין מספיק שעות שניתן לחבר.','{{subject}} in {{class}} needs {{doubles}} doubles, but there aren\'t enough joinable slot pairs on {{teacher}}\'s working days.'),
 'W_GROUP_SPREAD':('ל{{subject}} ב־{{class}} יש {{hours}} שעות ב־{{days}} ימים, ולכן יהיו ימים עם יותר משעתיים.','{{subject}} in {{class}} has {{hours}} hours over {{days}} days, so some days will have more than 2.'),
 'E_TEACHER_HOURS_INVALID':('למורה {{teacher}} מקסימום שעות לא תקין ({{hours}}).','{{teacher}} has an invalid maximum ({{hours}}).'),
 'E_TEACHER_DAILY_INVALID':('למורה {{teacher}} מקסימום יומי לא תקין ({{hours}}).','{{teacher}} has an invalid daily max ({{hours}}).'),
 'E_TEACHER_NO_SUBJECTS':('למורה {{teacher}} לא נבחרו מקצועות הוראה.','{{teacher}} has no subjects.'),
 'E_TEACHER_DAY_OFF_INVALID':('היום החופשי של {{teacher}} ({{day}}) אינו יום לימודים. יש לבחור יום אחר.','{{teacher}}\'s day off ({{day}}) is not a teaching day. Choose another.'),
 'E_TEACHER_OVER_X':('למורה {{teacher}} שובצו {{hours}} שעות בגיליון, יותר מהמקסימום ({{max}}).','{{teacher}} has {{hours}} hours in the planning sheet, more than their maximum ({{max}}).'),
 'E_TEACHER_DAILY_CAPACITY':('למורה {{teacher}} יש {{hours}} שעות, אבל רק {{days}} ימי עבודה × {{perDay}} ביום = {{capacity}}.','{{teacher}}: {{hours}} hours but only {{days}} working days × {{perDay}} per day = {{capacity}}.'),
 'E_TEACHER_SLOT_CAPACITY':('למורה {{teacher}} יש {{hours}} שעות, אבל רק {{slots}} שעות פנויות מחסמים בימי העבודה.','{{teacher}}: {{hours}} hours but only {{slots}} unblocked lesson slots on working days.'),
 'I_TEACHER_UNDER_X':('שובצו {{hours}} מתוך מקסימום {{max}} שעות למורה {{teacher}}.','{{teacher}}: {{hours}} of max {{max}} h assigned.'),
 'I_TEACHER_UNDER_MAX':('שובצו {{assigned}} מתוך מקסימום {{max}} שעות למורה {{teacher}}.','{{teacher}}: {{assigned}} of max {{max}} h assigned.'),
 'I_TEACHER_NO_GROUPS':('למורה {{teacher}} עוד אין שעות בגיליון.','{{teacher}} has no hours in the planning sheet yet.'),
 'E_CLASS_OVER_SLOTS':('לכיתה {{class}} יש {{hours}} שעות בקבוצות הלימוד, אבל רק {{slots}} שעות לימוד פנויות בשבוע.','{{class}} has {{hours}} hours of study groups but only {{slots}} available lesson slots.'),
 'I_CLASS_NO_GROUPS':('לכיתה {{class}} עוד אין קבוצות לימוד.','{{class}} has no study groups yet.'),
 'W_CLASS_HOMEROOM_TEACHER_UNKNOWN':('מחנך הכיתה של {{class}} נמחק.','{{class}}\'s homeroom teacher was deleted.'),
 'W_ROOM_UNKNOWN_TYPE':('לחדר {{room}} אין סוג חדר תקין.','Room {{room}} has no valid room type.'),
 'E_ROOM_TYPE_CAPACITY':('לחדרים מסוג ״{{roomType}}״ נדרשות {{hours}} שעות, אבל יש רק {{slots}} שעות אפשריות.','Rooms of type "{{roomType}}": {{hours}} hours needed but only {{slots}} possible.'),
 'E_ROOM_CAPACITY':('בחדר ״{{room}}״ נדרשות {{hours}} שעות, אבל יש בו רק {{slots}} שעות פנויות.','Room "{{room}}" needs {{hours}} hours but has only {{slots}} free slots.'),
 'W_BLOCK_UNKNOWN_TARGET':('חסם מפנה ליעד שנמחק ({{target}}).','A block points to a deleted target ({{target}}).'),
 'W_BLOCK_REMOVED_DAY':('חסם מפנה ליום {{day}}, שהוסר מהשבוע.','A block points to {{day}}, which is no longer a teaching day.'),
 'W_BLOCK_REMOVED_SLOT':('חסם ביום {{day}} מפנה ל־{{count}} שעות שהוסרו מלוח הצלצולים.','A block on {{day}} points to {{count}} slots that were removed.'),
 'W_CLUSTERS_NOT_SUPPORTED':('בקובץ יש {{count}} אשכולות. אשכולות עוד לא נתמכים בשיבוץ.','The data has {{count}} clusters. Clusters aren\'t scheduled yet.'),
 'W_DUPLICATE_NAME':('השם ״{{name}}״ מופיע יותר מפעם אחת.','The name "{{name}}" appears more than once.'),
 'W_EMPTY_NAME':('יש רשומה בלי שם.','A record has no name.'),
 'U_GROUP_INVALID':('{{subject}} ב־{{class}}: הקבוצה לא תקינה (ראו בדיקת תקינות).','{{subject}} in {{class}}: the group is invalid (see Validate).'),
 'U_NO_JOINABLE_PAIR':('{{subject}} ב־{{class}}: אין שעות שניתן לחבר לשיעור כפול.','{{subject}} in {{class}}: no joinable slot pair for a double.'),
 'U_NO_COMMON_SLOT':('{{subject}} ב־{{class}}: אין שעה שבה גם {{teacher}} וגם הכיתה פנויים.','{{subject}} in {{class}}: no slot where both {{teacher}} and the class are free.'),
 'U_TEACHER_CAP':('{{subject}} ב־{{class}}: {{teacher}} הגיע/ה למקסימום היומי בכל השעות הפנויות.','{{subject}} in {{class}}: {{teacher}} is at the daily max in every free slot.'),
 'U_NO_ROOM_OR_SEARCH_LIMIT':('{{subject}} ב־{{class}}: לא נמצא חדר פנוי או שהחיפוש הגיע למגבלה.','{{subject}} in {{class}}: no free room, or the search hit its limit.'),
 'V_TEACHER_CLASH':('למורה {{name}} יש {{count}} שיעורים ב{{day}}, שעה {{period}}.','{{name}} has {{count}} lessons on {{day}}, period {{period}}.'),
 'V_CLASS_CLASH':('לכיתה {{name}} יש {{count}} שיעורים ב{{day}}, שעה {{period}}.','{{name}} has {{count}} lessons on {{day}}, period {{period}}.'),
 'V_ROOM_CLASH':('החדר ״{{name}}״ תפוס {{count}} פעמים ב{{day}}, שעה {{period}}.','Room "{{name}}" is booked {{count}} times on {{day}}, period {{period}}.'),
 'V_LESSON_LENGTH':('שיעור באורך לא תקין ({{count}} שעות).','A lesson has an invalid length ({{count}} slots).'),
 'V_UNKNOWN_GROUP':('שיעור מפנה לקבוצה שנמחקה.','A lesson points to a deleted group.'),
 'V_GROUP_HOURS':('ל{{subject}} ב־{{class}} שובצו {{placed}} מתוך {{required}} שעות.','{{subject}} in {{class}}: {{placed}} of {{required}} hours placed.'),
 'V_GROUP_DOUBLES':('ל{{subject}} ב־{{class}} שובצו {{placed}} מתוך {{required}} כפולים.','{{subject}} in {{class}}: {{placed}} of {{required}} doubles placed.'),
 'V_INVALID_DOUBLE':('שיעור כפול ב{{day}}, שעה {{period}}, אינו על שעות שניתן לחבר.','A double on {{day}}, period {{period}}, isn\'t on a joinable pair.'),
 'V_NOT_TEACHING_DAY':('שיעור ב{{day}}, שאינו יום לימודים.','A lesson on {{day}}, which isn\'t a teaching day.'),
 'V_INVALID_SLOT':('שיעור ב{{day}} בשעה שאינה שעת לימוד.','A lesson on {{day}} in a slot that isn\'t a lesson slot.'),
 'V_ZERO_HOUR':('שיעור בשעה אפס ב{{day}}, אבל שעה אפס אינה מותרת.','A lesson in zero hour on {{day}}, but zero hour isn\'t allowed.'),
 'V_TEACHER_NOT_QUALIFIED':('המקצוע {{subject}} לא מופיע ברשימת המקצועות של המורה {{teacher}}.','{{subject}} isn\'t in {{teacher}}\'s subject list.'),
 'V_TEACHER_DAY_OFF':('{{day}} הוא היום החופשי של המורה {{teacher}}.','{{day}} is {{teacher}}\'s day off.'),
 'V_TEACHER_WEEKLY_CAP':('למורה {{teacher}} שובצו {{assigned}} שעות, יותר מהמקסימום ({{max}}).','{{teacher}} has {{assigned}} h, more than their maximum ({{max}}).'),
 'V_TEACHER_DAILY_CAP':('ב{{day}} ל{{teacher}} יש {{hours}} שעות, יותר מהמקסימום היומי ({{max}}).','{{teacher}} teaches {{hours}} hours on {{day}}, more than the daily max ({{max}}).'),
 'V_ROOM_NOT_EXPECTED':('ל{{subject}} ב־{{class}} לא נדרש חדר, אבל שובץ חדר.','{{subject}} in {{class}} needs no room, but one was assigned.'),
 'V_ROOM_COUNT':('ל{{subject}} ב־{{class}} שובצו {{count}} חדרים במקום {{expected}}.','{{subject}} in {{class}}: {{count}} rooms instead of {{expected}}.'),
 'V_ROOM_REQUIREMENT':('החדר ״{{room}}״ אינו מתאים ל{{subject}} ב־{{class}} ({{day}}, שעה {{period}}).','Room "{{room}}" doesn\'t fit {{subject}} in {{class}} ({{day}}, period {{period}}).'),
 'V_HARD_BLOCK':('{{subject}} ב־{{class}} שובץ בשעה חסומה ({{day}}, שעה {{period}}, {{target}}).','{{subject}} in {{class}} is in a hard-blocked slot ({{day}}, period {{period}}, {{target}}).'),
 'V_CLUSTER_MISMATCH':('קבוצות האשכול ״{{cluster}}״ אינן באותן שעות.','The groups of cluster "{{cluster}}" aren\'t in the same slots.'),
}
I.update({
 'E_GROUP_NO_TEACHER':('ל{{subject}} ב־{{class}} לא נבחר מורה.','{{subject}} in {{class}} has no teacher.'),
 'E_GROUP_NO_QUALIFIED_TEACHER':('ל{{subject}} ב־{{class}} לא נבחר מורה, ואין אף מורה שמלמד את המקצוע.','{{subject}} in {{class}} is set to Auto, but no teacher is qualified for it.'),
 'E_SUBJECT_AUTO_CAPACITY':('{{subject}}: קבוצות אוטומטיות צריכות {{hours}} שעות, אבל למורים המוסמכים יש רק {{free}} שעות פנויות.','{{subject}}: auto groups need {{hours}} hours but qualified teachers have only {{free}} free.'),
 'E_AUTO_ASSIGNMENT_INFEASIBLE':('אי אפשר לשבץ מורים לכל הקבוצות האוטומטיות: חסרות {{missing}} מתוך {{hours}} שעות (מורים משותפים לכמה מקצועות).','Teachers can\'t be assigned to all auto groups: {{missing}} of {{hours}} hours are missing (teachers shared across subjects).'),
 'W_SHARED_HOMEROOM':('לכיתות {{classes}} אותה כיתת אם ({{room}}).','{{classes}} share homeroom {{room}}.'),
 'U_NO_TEACHER_AVAILABLE':('{{subject}} ב־{{class}}: לא נמצא מורה מוסמך עם שעות פנויות.','{{subject}} in {{class}}: no qualified teacher with free hours.'),
 'V_GROUP_NO_TEACHER':('ל{{subject}} ב־{{class}} אין מורה משובץ.','{{subject}} in {{class}} has no resolved teacher.'),
 'V_FIXED_TEACHER_CHANGED':('המורה הקבוע של {{subject}} ב־{{class}} הוחלף ב־{{teacher}}.','The fixed teacher of {{subject}} in {{class}} was replaced by {{teacher}}.'),
 'V_GROUP_TEACHER_INCONSISTENT':('השיעורים של {{subject}} ב־{{class}} ניתנים על ידי מורים שונים.','The lessons of {{subject}} in {{class}} have different teachers.'),
})
for code,(he,en) in I.items(): k(f'issues.{code}', he, en)
k('issues.unknown','בעיה: {{code}}','Issue: {{code}}')

# --- v0.5.2 UI shell (ship-now pass) ---
for i,(he_,en_) in enumerate([('כחול','Blue'),('ירוק','Green'),('ענבר','Amber'),('סגול','Violet'),('ורוד','Rose'),('טורקיז','Teal'),('כתום','Orange'),('פוקסיה','Fuchsia'),('ליים','Lime'),('תכלת','Sky'),('אינדיגו','Indigo'),('אבן','Stone')], start=1):
    k(f'color.subject-{i}', he_, en_)
k('blocks.free','פנוי','Free'); k('blocks.helpCycle','לחיצה על תא מחליפה: פנוי → חסם קשיח → חסם רך → פנוי.','Click a cell to cycle: free → hard block → soft block → free.')
k('classes.parallels','מספר מקבילות','Number of parallels')
k('confirm.deleteSubject','מחיקת {{name}} תמחק גם {{count}} קבוצות לימוד. להמשיך?','Deleting {{name}} also deletes {{count}} study groups. Continue?')
k('export.printHelp','להדפסה: פותחים את מערכת השעות, בוחרים כיתה, מורה או חדר ולוחצים ״הדפסה״.','To print: open the timetable, pick a class, teacher or room and press Print.')
k('gen.minutes','{{n}} דק׳','{{n}} min'); k('gen.seconds','{{n}} שניות','{{n}} s')
k('home.sampleConfirm','טעינת בית ספר לדוגמה תחליף את הנתונים הנוכחיים (אפשר לבטל עם ״ביטול פעולה״). להמשיך?','Loading a sample school replaces the current data (Undo is available). Continue?')
k('home.samples','בתי ספר לדוגמה','Sample schools'); k('home.samplesHelp','חטיבת ביניים קטנה (9 כיתות) או גדולה (24 כיתות), מוכנות ליצירת מערכת.','A small (9 classes) or large (24 classes) middle school, ready to generate.')
k('planning.addGroup','הוספת קבוצה','Add group')
k('room.homeroom','כיתת האם','Homeroom'); k('room.none','ללא חדר','No room')
k('roomType.new','סוג חדר חדש','New room type'); k('subject.new','מקצוע חדש','New subject'); k('teacher.new','מורה חדש','New teacher')
k('timetable.daily','לפי יום: {{list}} (מקסימום {{max}})','Per day: {{list}} (max {{max}})')
k('timetable.teacherSummary','{{hours}} שעות מתוך {{max}} ש״ש','{{hours}} of {{max}} weekly hours')
k('week.regularName','רגיל','Regular'); k('week.fridayName','שישי','Friday')

he = {key: v[0] for key, v in T.items()}
en = {key: v[1] for key, v in T.items()}
out = os.path.join(os.path.dirname(__file__), '..', 'src', 'i18n')
for name, d in [('he', he), ('en', en)]:
    with open(os.path.join(out, f'{name}.json'), 'w', encoding='utf-8') as f:
        json.dump(d, f, ensure_ascii=False, indent=2); f.write('\n')
print(len(T), 'keys')
