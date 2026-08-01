#!/bin/sh
set -eu

config_path=${1:-personal-learning-config.yaml}

if [ ! -f "$config_path" ]; then
  echo "Config not found: $config_path" >&2
  exit 1
fi

ruby -ryaml - "$config_path" <<'RUBY'
path = ARGV.fetch(0)

begin
  yaml = File.read(path, encoding: "UTF-8")
  config = YAML.safe_load(yaml, permitted_classes: [], aliases: false)
rescue Psych::Exception, Encoding::InvalidByteSequenceError, Encoding::UndefinedConversionError => error
  warn "Invalid YAML in #{path}: #{error.message}"
  exit 1
end

def fail_field(path, expectation)
  warn "Invalid #{path}: expected #{expectation}"
  exit 1
end

def assert_keys(mapping, path, allowed)
  unknown = mapping.keys - allowed
  return if unknown.empty?

  warn "Invalid #{path}: unknown fields #{unknown.map(&:inspect).join(', ')}; allowed fields: #{allowed.join(', ')}"
  exit 1
end

fail_field("root", "a mapping") unless config.is_a?(Hash)
assert_keys(config, "root", %w[version language learner])
fail_field("version", "integer 1") unless config["version"] == 1

language = config["language"]
fail_field("language", "a non-empty string") unless language.is_a?(String) && !language.strip.empty?

learner = config["learner"]
fail_field("learner", "a mapping") unless learner.is_a?(Hash)
assert_keys(learner, "learner", %w[goal experience known_domains])

goal = learner["goal"]
fail_field("learner.goal", "a non-empty string") unless goal.is_a?(String) && !goal.strip.empty?

experience = learner["experience"]
fail_field("learner.experience", "a mapping") unless experience.is_a?(Hash)
assert_keys(experience, "learner.experience", %w[frontend_years])
years = experience["frontend_years"]
fail_field("learner.experience.frontend_years", "a non-negative integer") unless years.is_a?(Integer) && years >= 0

domains = learner["known_domains"]
valid_domains = domains.is_a?(Array) && !domains.empty? && domains.all? { |item| item.is_a?(String) && !item.strip.empty? }
fail_field("learner.known_domains", "a non-empty array of strings") unless valid_domains

puts "Valid personal-learning config: #{path}"
RUBY
