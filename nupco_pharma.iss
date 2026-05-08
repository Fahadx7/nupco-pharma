; نوبكو فارما - مثبت احترافي v5.10
[Setup]
AppName=نوبكو فارما
AppVersion=5.10
DefaultDirName={commonpf}\NupcoPharma
DefaultGroupName=نوبكو فارما
OutputDir=.
OutputBaseFilename=NupcoPharma_Setup_5.10
Compression=lzma2
SolidCompression=yes
PrivilegesRequired=admin
WizardStyle=modern
DisableProgramGroupPage=yes
SetupLogging=yes

[Languages]
Name: "arabic"; MessagesFile: "compiler:Languages\Arabic.isl"

[Files]
; نسخ جميع ملفات المشروع (مسار نسبي - يعمل على أي جهاز)
Source: "*";          DestDir: "{app}"; Flags: recursesubdirs ignoreversion; \
  Excludes: "node_modules\*,*.iss,NupcoPharma_Setup*,pharmacy.db,config.json"

[Tasks]
Name: "desktopicon"; Description: "إنشاء اختصار على سطح المكتب"; GroupDescription: "خيارات إضافية"

[Icons]
Name: "{commondesktop}\نوبكو فارما"; Filename: "{app}\run.bat";     Tasks: desktopicon
Name: "{group}\تشغيل نوبكو فارما";   Filename: "{app}\run.bat"
Name: "{group}\إعداد نوبكو فارما";   Filename: "{app}\install.bat"
Name: "{group}\إلغاء التثبيت";        Filename: "{uninstallexe}"

[Run]
; تثبيت المتطلبات (Node.js + المكتبات)
Filename: "{app}\install.bat"; \
  Flags: waituntilterminated; \
  StatusMsg: "جاري تثبيت المتطلبات (Node.js والمكتبات)..."

; تشغيل البوت بعد الانتهاء (اختياري)
Filename: "{app}\run.bat"; \
  Flags: postinstall nowait shellexec; \
  Description: "تشغيل البوت الآن"
