; نوبكو فارما - مثبت احترافي (نسخة مبسطة بدون أيقونات)
[Setup]
AppName=نوبكو فارما
AppVersion=5.05
DefaultDirName={pf}\NupcoPharma
DefaultGroupName=نوبكو فارما
UninstallDisplayIcon={app}\index.js
OutputDir=.
OutputBaseFilename=NupcoPharma_Setup
Compression=lzma2
SolidCompression=yes
PrivilegesRequired=admin
WizardStyle=modern
DisableProgramGroupPage=yes

[Languages]
Name: "arabic"; MessagesFile: "compiler:Languages\Arabic.isl"

[Files]
Source: "C:\Users\User\Desktop\NupcoPharmaSource\*"; DestDir: "{app}"; Flags: recursesubdirs

[Tasks]
Name: "desktopicon"; Description: "إنشاء اختصار على سطح المكتب"

[Icons]
Name: "{userdesktop}\نوبكو فارما"; Filename: "{app}\run.bat"; Tasks: desktopicon

[Run]
Filename: "{cmd}"; Parameters: "/c npm install --silent"; WorkingDir: "{app}"; Flags: runhidden; StatusMsg: "تثبيت المكتبات..."
Filename: "{app}\run.bat"; Flags: postinstall nowait runhidden