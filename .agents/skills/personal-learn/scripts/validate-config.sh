#!/bin/sh
set -eu

config_path=${1:-personal-learn-config.yaml}

if [ ! -f "$config_path" ]; then
  echo "Config not found: $config_path" >&2
  exit 1
fi

ruby -ryaml - "$config_path" <<'RUBY'
path = ARGV.fetch(0)

begin
  config = YAML.safe_load(File.read(path), permitted_classes: [], aliases: false)
rescue Psych::Exception => error
  warn "Invalid YAML in #{path}: #{error.message}"
  exit 1
end

def fail_field(path, expectation)
  warn "Invalid #{path}: expected #{expectation}"
  exit 1
end

fail_field("root", "a mapping") unless config.is_a?(Hash)
fail_field("version", "integer 1") unless config["version"] == 1

language = config["language"]
fail_field("language", "a non-empty string") unless language.is_a?(String) && !language.strip.empty?

learner = config["learner"]
fail_field("learner", "a mapping") unless learner.is_a?(Hash)

goal = learner["goal"]
fail_field("learner.goal", "a non-empty string") unless goal.is_a?(String) && !goal.strip.empty?

experience = learner["experience"]
fail_field("learner.experience", "a mapping") unless experience.is_a?(Hash)
years = experience["frontend_years"]
fail_field("learner.experience.frontend_years", "a non-negative integer") unless years.is_a?(Integer) && years >= 0

domains = learner["known_domains"]
valid_domains = domains.is_a?(Array) && !domains.empty? && domains.all? { |item| item.is_a?(String) && !item.strip.empty? }
fail_field("learner.known_domains", "a non-empty array of strings") unless valid_domains

recommendations = config["level_recommendations"]
fail_field("level_recommendations", "a mapping") unless recommendations.is_a?(Hash)

allowed_levels = %w[beginner survey deep-dive expert].freeze
required_recommendations = %w[
  known_technical_domains
  adjacent_technical_domains
  unfamiliar_domains
  quick_overview
].freeze

required_recommendations.each do |key|
  value = recommendations[key]
  fail_field("level_recommendations.#{key}", "one of #{allowed_levels.join(', ')}") unless allowed_levels.include?(value)
end

puts "Valid personal-learn config: #{path}"
RUBY
