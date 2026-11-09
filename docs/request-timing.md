# Checking whether a slow page was the server or the user's device

The web server's access log records how long every request took, and the log is kept on the
host's journal so it survives a redeploy (it used to vanish with the container).

Each line looks like:

    168.140.249.210 [09/Nov/2026:00:43:48 +0000] "GET /api/notifications/ HTTP/2.0" 200 395 rt=0.012 urt=0.011 "Mozilla/5.0 ... Edg/156.0.0.0" xff="-"

- `rt`  — seconds from the first byte received to the last byte sent. It includes the time the
  browser took to download the answer, so a slow connection or device makes it larger.
- `urt` — seconds the backend took to answer. `-` for static files.

**Reading it.** `urt` large means the backend was slow (a server problem). `rt` large with
`urt` small means the time went on the way to the browser (network or the person's device).

Everyone in the OPSC office shares one public address, so tell people apart by the time and the
`user-agent` (browser and version), not by the IP.

## Commands (on the server)

Everything from the last two hours:

    sudo journalctl -t scdms-web --since "2 hours ago" --no-pager

Only slow requests (rt over 1 second), newest last:

    sudo journalctl -t scdms-web --since "today" --no-pager -o cat | awk '{for(i=1;i<=NF;i++) if($i ~ /^rt=/){split($i,a,"="); if(a[2]>1) print}}'

Requests from one browser version (for example a particular Edge):

    sudo journalctl -t scdms-web --since "today" --no-pager -o cat | grep "Edg/151"

## Notes

- The journal is capped by the host's `journald` settings (default: a share of the disk), so
  old lines roll off eventually. It is not a long-term archive.
- The Director-General approval link is deliberately never logged, because its URL carries a
  secret.
- Assets under `/assets/` are not logged at all (`access_log off`), so first-load download
  time of the app bundle does not appear here. Time that in the browser's developer tools
  (Network tab) if you suspect it.
