$runId = 'cmpmurtjj000113tb1l26m4et'
while ($true) {
  $run = Invoke-RestMethod "http://localhost:3001/api/runs/$runId"
  Write-Host "Status: $($run.data.status) | Passed: $($run.data.passedSteps)/$($run.data.totalSteps)"
  if ($run.data.status -eq 'passed' -or $run.data.status -eq 'failed') { break }
  Start-Sleep -Seconds 5
}
