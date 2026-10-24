<!--
Release notes template. Paste this into the description of the GitHub Release for the tag
(Releases > Draft a new release), fill it in and delete these comments.
Keep "Migrations that rewrite data" in every release, even when the answer is "None".
-->

## Upgrade

Follow the upgrade steps in the README. They start with a backup. The app applies its migrations when it starts.

<!-- For a major release (2.0.0), also say here what breaks and what a self-hoster must change. -->

## Migrations that rewrite data

<!--
List every migration in drizzle/ since the last release that changes or deletes existing rows:
a backfill, a dropped column, a type change. Say what it rewrites, in household terms
("every pocket gets a currency, THB for existing pockets"). Pull requests flag these.
If no migration rewrites data, write "None."
-->

None.

## Changes

<!-- What's new and what's fixed, for a household. GitHub's "Generate release notes" button can list the merged pull requests. -->
