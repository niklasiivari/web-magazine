package main

import (
	"flag"
	"log"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

const distDir = "./dist"

func main() {
	healthCheck := flag.Bool("healthcheck", false, "Run healthcheck and exit")
	flag.Parse()

	// The scratch image has no /etc/mime.types, so Go falls back to its
	// builtin table. That table covers .html/.css/.js/.svg/.png but not
	// .webmanifest, which would otherwise be sniffed as text/plain — wrong
	// for the spec, and not in the reverse proxy's gzip_types.
	if err := mime.AddExtensionType(".webmanifest", "application/manifest+json"); err != nil {
		log.Fatalf("registering .webmanifest mime type: %v", err)
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	if *healthCheck {
		resp, err := http.Get("http://127.0.0.1:" + port + "/")
		if err != nil || resp.StatusCode != http.StatusOK {
			os.Exit(1)
		}
		os.Exit(0)
	}

	fs := http.FileServer(http.Dir(distDir))

	absDist, err := filepath.Abs(distDir)
	if err != nil {
		log.Fatalf("resolving %s: %v", distDir, err)
	}
	insideDist := func(path string) bool {
		abs, err := filepath.Abs(path)
		return err == nil && strings.HasPrefix(abs, absDist+string(os.PathSeparator))
	}

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")

		// Astro static output: clean URLs with trailingSlash "never".
		// Try <path>.html, then <path>/index.html; if neither exists this
		// is an unknown page, so serve the styled 404 rather than falling
		// through to the file server's bare-text response.
		if !strings.Contains(filepath.Base(r.URL.Path), ".") {
			for _, candidate := range []string{r.URL.Path + ".html", strings.TrimSuffix(r.URL.Path, "/") + "/index.html"} {
				full := filepath.Join(distDir, filepath.Clean(candidate))
				if !insideDist(full) {
					continue
				}
				if info, err := os.Stat(full); err == nil && !info.IsDir() {
					w.Header().Set("Cache-Control", "no-cache")
					http.ServeFile(w, r, full)
					return
				}
			}

			notFoundPage, err := os.ReadFile(filepath.Join(distDir, "404.html"))
			if err != nil {
				http.NotFound(w, r)
				return
			}
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.Header().Set("Cache-Control", "no-cache")
			w.WriteHeader(http.StatusNotFound)
			w.Write(notFoundPage)
			return
		}

		// Only /_astro/ filenames carry a content hash, so only those are
		// safe to cache immutably. Everything else (favicons, PWA icons,
		// anything under /media/) is served under a stable name and must
		// stay revalidatable, or it can never be updated.
		if strings.HasPrefix(r.URL.Path, "/_astro/") {
			w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		} else {
			w.Header().Set("Cache-Control", "no-cache")
		}

		fs.ServeHTTP(w, r)
	})

	log.Printf("Serving static site on port %s", port)
	log.Fatal(http.ListenAndServe(":"+port, nil))
}
