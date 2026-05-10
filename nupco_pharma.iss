; نوبكو فارما - مثبت احترافي v5.1.0
[Setup]
AppName=نوبكو فارما
AppVersion=5.1.0
AppPublisher=Fahad Al-Tayyari
DefaultDirName={commonpf}\NupcoPharma
DefaultGroupName=نوبكو فارما
OutputDir=.
OutputBaseFilename=NupcoPharma_Setup_5.1.0
Compression=lzma2
SolidCompression=yes
PrivilegesRequired=admin
WizardStyle=modern
DisableProgramGroupPage=yes
SetupLogging=yes
UninstallDisplayName=نوبكو فارما
AppSupportURL=https://t.me/AbuAmran2000_10

[Languages]
Name: "arabic"; MessagesFile: "compiler:Languages\Arabic.isl"

[Files]
; Main app files (excluding dev artifacts)
Source: "*";           DestDir: "{app}"; Flags: ignoreversion; \
  Excludes: "*.iss,NupcoPharma_Setup*,pharmacy.db,config.json,*.bak,*.bak2,*.log,write_html.py,temp_reference.jsx"
Source: "src\*";       DestDir: "{app}\src";    Flags: recursesubdirs ignoreversion
Source: "public\*";    DestDir: "{app}\public";  Flags: recursesubdirs ignoreversion
Source: ".github\*";   DestDir: "{app}\.github"; Flags: recursesubdirs ignoreversion; Check: DirExists('.github')

[Tasks]
Name: "desktopicon"; Description: "إنشاء اختصار على سطح المكتب"; GroupDescription: "خيارات إضافية"
Name: "autostart";   Description: "تشغيل تلقائي عند بدء Windows"; GroupDescription: "خيارات إضافية"; Flags: unchecked

[Icons]
Name: "{commondesktop}\نوبكو فارما";  Filename: "{app}\run.bat"; Tasks: desktopicon; Comment: "نظام إدارة مخزون الأدوية"
Name: "{group}\تشغيل نوبكو فارما";   Filename: "{app}\run.bat"
Name: "{group}\إعداد نوبكو فارما";   Filename: "{app}\install.bat"
Name: "{group}\إلغاء التثبيت";        Filename: "{uninstallexe}"

[Registry]
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; \
  ValueName: "NupcoPharma"; ValueData: """{app}\run.bat"""; \
  Flags: uninsdeletevalue; Tasks: autostart

[Run]
; Step 1: Install Node.js packages
Filename: "{cmd}"; \
  Parameters: "/c ""{app}\install.bat"""; \
  WorkingDir: "{app}"; \
  Flags: waituntilterminated; \
  StatusMsg: "جاري تثبيت المكتبات... قد يأخذ 3-5 دقائق"

; Step 2: Launch app after install
Filename: "{app}\run.bat"; \
  Flags: postinstall nowait shellexec; \
  Description: "تشغيل نوبكو فارما الآن"
