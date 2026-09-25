# Security policy

## Reporting a vulnerability

Please report security problems privately, not in a public issue. Use GitHub's
private vulnerability reporting: open the repository's **Security** tab and
choose **Report a vulnerability**. Include what you found, how to reproduce it,
and what an attacker could do with it.

The maintainer aims to reply within a week. Once a fix is ready, it is
released and the report is credited, unless you ask not to be named.

## Supported versions

Fixes go into the latest release only. If you run an older version, update to
the newest release or the newest `main`.

## A leaked API key

If a `TYPESAFE_API_KEY` is exposed, in a commit, a log, a screenshot or
anywhere else, revoke it in TypeSafe's dashboard straight away and create a new
one. Removing it from git history is not enough, since copies may already
exist. The app only reads the key on the server and never sends it to the
browser; if you find a way to make it do so, please report it as above.

## Scope

In scope: this repository's code, its Docker image, and its default
configuration. Out of scope: TypeSafe's API, Stockfish, and hosting platforms,
which have their own reporting channels, as well as rate limits being too
generous on a self-hosted instance, which the operator sets.
