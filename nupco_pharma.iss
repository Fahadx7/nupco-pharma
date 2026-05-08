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
Source: "dist\medtracker.exe";      DestDir: "{app}"; Flags: ignoreversion
Source: "dist\better_sqlite3.node"; DestDir: "{app}"; Flags: ignoreversion
Source: "public\*";                 DestDir: "{app}\public"; Flags: recursesubdirs ignoreversion
Source: "run.bat";                  DestDir: "{app}"; Flags: ignoreversion

[Tasks]
Name: "desktopicon"; Description: "إنشاء اختصار على سطح المكتب"; GroupDescription: "خيارات إضافية"

[Icons]
Name: "{commondesktop}\نوبكو فارما"; Filename: "{app}\run.bat"; Tasks: desktopicon
Name: "{group}\تشغيل نوبكو فارما";  Filename: "{app}\run.bat"
Name: "{group}\إلغاء التثبيت";       Filename: "{uninstallexe}"

[Run]
Filename: "{app}\run.bat"; \
  Flags: postinstall nowait shellexec; \
  Description: "تشغيل البوت الآن"
