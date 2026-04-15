; نوبكو فارما — NSIS Installer Customization
; صُنع بـ❤️ فهد A

!macro customHeader
  !system "echo 'Building Nupco Pharma Installer...'"
!macroend

!macro customInstall
  ; Create app data directory
  CreateDirectory "$APPDATA\NupcoPharma"
!macroend

!macro customUnInstall
  ; Clean up app data on uninstall (optional - preserve user data by default)
  ; RMDir /r "$APPDATA\NupcoPharma"
!macroend
