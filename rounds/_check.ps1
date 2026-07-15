Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$roundsDir = Join-Path $repoRoot 'rounds'
$htmlFiles = @(
	(Join-Path $repoRoot 'abc.html'),
	(Join-Path $repoRoot 'favorites.html')
)

$utf8 = [System.Text.UTF8Encoding]::new($false)

function Read-Utf8Text {
	param(
		[Parameter(Mandatory)]
		[string]$Path
	)

	[System.IO.File]::ReadAllText($Path, $utf8)
}


function Get-RoundScripts {
	Get-ChildItem -LiteralPath $roundsDir -File -Filter '*.js' |
		Where-Object { -not $_.Name.StartsWith('_') -and $_.Name -ne 'data.js' } |
		ForEach-Object {
			$raw = Read-Utf8Text -Path $_.FullName
			$isIncomplete = $raw -match 'definition\s*:\s*""\s*,'
			[pscustomobject]@{
				Name = $_.Name
				Src = "rounds/$($_.Name)"
				IsIncomplete = $isIncomplete
			}
		}
}

function Get-RequiredScriptSrcs {
	@('rounds/data.js') + @(Get-RoundScripts | ForEach-Object { $_.Src })
	}

function Get-CompleteRoundScriptSrcs {
	@(Get-RoundScripts | Where-Object { -not $_.IsIncomplete } | ForEach-Object { $_.Src })
}

function Get-IncompleteRoundScriptSrcs {
	@(Get-RoundScripts | Where-Object { $_.IsIncomplete } | ForEach-Object { $_.Src })
}

function Get-ExistingScriptSrcs {
	param(
		[Parameter(Mandatory)]
		[string]$HtmlPath
	)

	$html = Read-Utf8Text -Path $HtmlPath
	[regex]::Matches(
		$html,
		'<script\b[^>]*\bsrc\s*=\s*["''](?<src>[^"'']+)["''][^>]*>\s*</script>',
		[System.Text.RegularExpressions.RegexOptions]::IgnoreCase
	) | ForEach-Object { $_.Groups['src'].Value }
}

function Get-RoundImportBlockSrcs {
	param(
		[Parameter(Mandatory)]
		[string]$HtmlPath
	)

	$html = Read-Utf8Text -Path $HtmlPath
	$blockMatch = [regex]::Match(
		$html,
		'(?s)<!-- start round data -->(?<block>.*?)<!-- insert rounds here -->'
	)

	if (-not $blockMatch.Success) {
		throw "Could not find round-data block in $HtmlPath."
	}

	[regex]::Matches(
		$blockMatch.Groups['block'].Value,
		'<script\b[^>]*\bsrc\s*=\s*["''](?<src>[^"'']+)["''][^>]*>\s*</script>',
		[System.Text.RegularExpressions.RegexOptions]::IgnoreCase
	) | ForEach-Object { $_.Groups['src'].Value }
}

function Update-HtmlFile {
	param(
		[Parameter(Mandatory)]
		[string]$HtmlPath
	)

	$html = Read-Utf8Text -Path $HtmlPath
	$newline = [System.Environment]::NewLine
	$roundScripts = @(Get-RoundScripts)
	$roundScriptBySrc = @{}
	foreach ($roundScript in $roundScripts) {
		$roundScriptBySrc[$roundScript.Src] = $roundScript
	}

	$existingBlockScripts = @(Get-RoundImportBlockSrcs -HtmlPath $HtmlPath)
	$completeScripts = New-Object System.Collections.Generic.List[string]
	$incompleteScripts = New-Object System.Collections.Generic.List[string]
	$seenScripts = New-Object 'System.Collections.Generic.HashSet[string]'

	foreach ($src in $existingBlockScripts) {
		if (-not $roundScriptBySrc.ContainsKey($src) -or $seenScripts.Contains($src)) {
			continue
		}

		$scriptInfo = $roundScriptBySrc[$src]
		if ($scriptInfo.IsIncomplete) {
			[void]$incompleteScripts.Add($src)
		}
		else {
			[void]$completeScripts.Add($src)
		}

		[void]$seenScripts.Add($src)
	}

	foreach ($scriptInfo in $roundScripts) {
		if ($seenScripts.Contains($scriptInfo.Src)) {
			continue
		}

		if ($scriptInfo.IsIncomplete) {
			[void]$incompleteScripts.Add($scriptInfo.Src)
		}
		else {
			[void]$completeScripts.Add($scriptInfo.Src)
		}
	}

	$missingScripts = @($roundScripts | Where-Object { $existingBlockScripts -notcontains $_.Src } | ForEach-Object { $_.Src })
	$completeLines = @($completeScripts | ForEach-Object { '        <script src="' + $_ + '"></script>' })
	$incompleteLines = @($incompleteScripts | ForEach-Object { '        <script src="' + $_ + '"></script>' })
	$rebuildBlock = @(
		$completeLines
		'        <!-- below here may be incomplete -->'
		$incompleteLines
	) -join $newline

	$markerPattern = '(?s)(<!-- start round data -->).*?(<!-- insert rounds here -->)'
	$html = [regex]::Replace($html, $markerPattern, {
		param($match)
		$prefix = $match.Groups[1].Value
		$suffix = $match.Groups[2].Value
		return $prefix + $newline + $rebuildBlock + $newline + $suffix
	})

	[System.IO.File]::WriteAllText($HtmlPath, $html, $utf8)
	if ($missingScripts.Count -eq 0) {
		Write-Host "$($HtmlPath): regrouped and up to date"
	}
	else {
		Write-Host "$($HtmlPath): regrouped and added $($missingScripts.Count) missing script(s) -> $($missingScripts -join ', ')"
	}
}

foreach ($htmlFile in $htmlFiles) {
	Update-HtmlFile -HtmlPath $htmlFile
}
