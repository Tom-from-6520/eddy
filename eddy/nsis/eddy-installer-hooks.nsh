; electron-builder NSIS hooks for the eddy omega Windows installer (eddy's copy of
; config/nsis/orca-installer-hooks.nsh; re-check it after upstream syncs).
;
; Differences from Orca's hooks, so eddy omega can sit next to an Orca install:
; - own ProgIDs, and no Software\Classes\Applications\Orca.exe entries (both apps' exe is Orca.exe);
; - no taskkill by image name on uninstall (it would also kill Orca and Orca's terminal daemon);
; - removes eddy omega's own relocated daemon folder (%LOCALAPPDATA%\eddy-omega), matching
;   EDDY_LOCAL_DATA_DIR_NAME in src/shared/eddy/eddy-build.ts.

!include "${__FILEDIR__}\..\..\config\nsis\orca-process-check.nsh"

!define MARKDOWN_PROGID "eddyOmega.Markdown"
!define TABULAR_PROGID "eddyOmega.Tabular"

!macro EDDY_REGISTER_DOCUMENT_OPEN_WITH EXT PROGID
  WriteRegNone SHELL_CONTEXT "Software\Classes\${EXT}\OpenWithProgids" "${PROGID}"
!macroend

!macro EDDY_UNREGISTER_DOCUMENT_OPEN_WITH EXT PROGID
  DeleteRegValue SHELL_CONTEXT "Software\Classes\${EXT}\OpenWithProgids" "${PROGID}"
!macroend

!macro EDDY_REGISTER_DOCUMENT_PROGID PROGID NAME
  WriteRegStr SHELL_CONTEXT "Software\Classes\${PROGID}" "" "${NAME}"
  WriteRegStr SHELL_CONTEXT "Software\Classes\${PROGID}\DefaultIcon" "" "$appExe,0"
  WriteRegStr SHELL_CONTEXT "Software\Classes\${PROGID}\shell\open" "" "Open with eddy"
  WriteRegStr SHELL_CONTEXT "Software\Classes\${PROGID}\shell\open\command" "" '"$appExe" "%1"'
!macroend

!macro customInstall
  !insertmacro EDDY_REGISTER_DOCUMENT_PROGID "${MARKDOWN_PROGID}" "Markdown Document"
  !insertmacro EDDY_REGISTER_DOCUMENT_PROGID "${TABULAR_PROGID}" "Tabular Document"
  !insertmacro EDDY_REGISTER_DOCUMENT_OPEN_WITH ".md" "${MARKDOWN_PROGID}"
  !insertmacro EDDY_REGISTER_DOCUMENT_OPEN_WITH ".markdown" "${MARKDOWN_PROGID}"
  !insertmacro EDDY_REGISTER_DOCUMENT_OPEN_WITH ".mdx" "${MARKDOWN_PROGID}"
  !insertmacro EDDY_REGISTER_DOCUMENT_OPEN_WITH ".csv" "${TABULAR_PROGID}"
  !insertmacro EDDY_REGISTER_DOCUMENT_OPEN_WITH ".tsv" "${TABULAR_PROGID}"
  System::Call "shell32::SHChangeNotify(i,i,i,i) (0x08000000, 0x1000, 0, 0)"
!macroend

!macro customUnInstall
  ; Updates run this uninstaller too; the relocated daemon must survive them.
  ${ifNot} ${isUpdated}
    RMDir /r "$LOCALAPPDATA\eddy-omega\daemon-host"
    RMDir /r "$LOCALAPPDATA\eddy-omega\daemon-host-profiles"
  ${endIf}
  DeleteRegKey SHELL_CONTEXT "Software\Classes\${MARKDOWN_PROGID}"
  DeleteRegKey SHELL_CONTEXT "Software\Classes\${TABULAR_PROGID}"
  !insertmacro EDDY_UNREGISTER_DOCUMENT_OPEN_WITH ".md" "${MARKDOWN_PROGID}"
  !insertmacro EDDY_UNREGISTER_DOCUMENT_OPEN_WITH ".markdown" "${MARKDOWN_PROGID}"
  !insertmacro EDDY_UNREGISTER_DOCUMENT_OPEN_WITH ".mdx" "${MARKDOWN_PROGID}"
  !insertmacro EDDY_UNREGISTER_DOCUMENT_OPEN_WITH ".csv" "${TABULAR_PROGID}"
  !insertmacro EDDY_UNREGISTER_DOCUMENT_OPEN_WITH ".tsv" "${TABULAR_PROGID}"
  System::Call "shell32::SHChangeNotify(i,i,i,i) (0x08000000, 0x1000, 0, 0)"
!macroend
