# Changelog

## Unreleased

## v1.0.0 - 2025-11-12

No breaking changes, but it is used in production.

- publish package with github actions

## v0.3.1 - 2025-10-06

- export format traceparent function

## v0.3.0 - 2025-10-06

- allow peer dependency pino-abstract-transport@3
- major bump pino@10

## v0.2.3 - 2025-08-21

- republish

## v0.2.2 - 2025-05-21

- structure timestamp as object with UTC seconds from epoch and fractional seconds as nanoseconds as stated in docs

## v0.1.3 - 2025-05-21

- keeps logged error with properties, unless ignored in ignore keys

## v0.1.2 - 2025-05-02

- map serialized error to source location

## v0.1.1 - 2025-05-02

- add SpanContext class to facilitate executing without request context
- expose function to get tracing context trace flags
- fix readme

## v0.1.0 - 2025-04-24

- support fastify hook

## v0.0.4 - 2025-04-07

- type: make flags optional for `getTraceHeadersAsObject` as well

## v0.0.3 - 2025-04-03

- map error stack to textPayload
- ignore mixed in properties that are null or undefined
- start documenting api

## v0.0.2 - 2025-03-31

- map error stack to source location

## v0.0.1 - 2025-03-29

First version
