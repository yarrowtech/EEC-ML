$tracked = @(
  'backend/__tests__/api.test.js',
  'backend/__tests__/example.test.js',
  'backend/__tests__/promotionRoutes.test.js',
  'backend/__tests__/studentPortalLogger.test.js',
  'backend/controllers/wellbeingController.js',
  'backend/index.js',
  'backend/middleware/superAdminAuth.js',
  'backend/routes/attendanceRoutes.js',
  'backend/routes/feeRoutes.js',
  'backend/routes/holidayRoutes.js',
  'backend/routes/meetingRoute.js',
  'backend/routes/parentRoute.js',
  'backend/routes/reportRoutes.js',
  'backend/routes/studentObservationRoutes.js',
  'backend/utils/authEventLogger.js',
  'backend/utils/holidayNotificationScheduler.js',
  'backend/utils/notificationService.js',
  'backend/utils/studentPortalLogger.js',
  'backend/utils/webhookSender.js',
  'docs/school-admin-api-map.md',
  'docs/student-portal-api-map.md',
  'docs/teacher-portal-api-map.md',
  'frontend/dist/index.html',
  'frontend/package-lock.json',
  'frontend/package.json',
  'frontend/src/__tests__/example.test.jsx',
  'frontend/src/main.jsx',
  'frontend/src/parents/__tests__/FeesPayment.test.jsx',
  'frontend/src/parents/__tests__/ParentPortal.test.jsx',
  'frontend/src/parents/__tests__/TESTING_IMPLEMENTATION_GUIDE.md',
  'frontend/src/parents/__tests__/__mocks__/mockData.js',
  'frontend/src/parents/__tests__/__utils__/testUtils.js',
  'frontend/src/teachers/__tests__/TeacherPortal.test.jsx'
)

$base = $PSScriptRoot

foreach ($p in $tracked) {
  $content = & git show "HEAD:$p"
  $full = [System.IO.Path]::Combine($base, $p)
  $dir = [System.IO.Path]::GetDirectoryName($full)
  if (!([System.IO.Directory]::Exists($dir))) {
    [System.IO.Directory]::CreateDirectory($dir) | Out-Null
  }
  [System.IO.File]::WriteAllText($full, ($content -join "`n"))
}

$untracked = @(
  'backend/__tests__/apiBootstrap.test.js',
  'backend/__tests__/authEventLogger.test.js',
  'backend/__tests__/logger.test.js',
  'backend/__tests__/loggerUtilities.test.js',
  'backend/__tests__/middlewareLoggers.test.js',
  'backend/__tests__/studentRouteRegistration.test.js',
  'backend/middleware/portalActionLogger.js',
  'docs/parent-portal-api-map.md',
  'frontend/src/utils/__tests__/logger.test.js',
  'frontend/src/utils/logger.js'
)

foreach ($p in $untracked) {
  $full = [System.IO.Path]::Combine($base, $p)
  if ([System.IO.File]::Exists($full)) {
    [System.IO.File]::SetAttributes($full, [System.IO.FileAttributes]::Normal)
    try {
      [System.IO.File]::Delete($full)
    } catch {
      Write-Host $full
    }
  }
}
