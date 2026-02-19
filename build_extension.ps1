$exclude = @("_backup", ".git", "*.zip", "build_extension.ps1", "sidebar", "README.md", "CHANGELOG.md", "task.md", "implementation_plan.md", "node_modules", ".editorconfig", ".gitignore")
$files = Get-ChildItem -Path . -Exclude $exclude

$zipName = "auto-tab-renamer-package.zip"
if (Test-Path $zipName) { Remove-Item $zipName }

Compress-Archive -Path $files.FullName -DestinationPath $zipName -Force

Write-Host "Created $zipName"
