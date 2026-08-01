#!/bin/sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
template_path="$script_dir/../assets/personal-learn-config.template.yaml"
repo_dir=${1:-"$PWD"}
destination="$repo_dir/personal-learn-config.yaml"

if [ ! -f "$template_path" ]; then
  echo "Missing config template: $template_path" >&2
  exit 2
fi

if [ -e "$destination" ]; then
  echo "Refusing to overwrite existing config: $destination" >&2
  exit 1
fi

cp "$template_path" "$destination"
echo "Created $destination"
