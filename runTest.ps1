$envs = Invoke-RestMethod -Uri "http://localhost:3001/api/environments"
$envId = $envs.data[0].id
$tests = Invoke-RestMethod -Uri "http://localhost:3001/api/test-cases"
$testId = ($tests.data | Where-Object { $_.name -like '*oracle*' })[0].id
Write-Host "Environment ID: $envId"
Write-Host "TestCase ID: $testId"

$body = @{ environmentId = $envId } | ConvertTo-Json
$response = Invoke-RestMethod -Uri "http://localhost:3001/api/replay/$testId" -Method Post -Body $body -ContentType "application/json"
$response | ConvertTo-Json
