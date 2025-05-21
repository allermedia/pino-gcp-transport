# Changelog

## Unreleased

## [0.2.1] - 2025-05-21

- structure timestamp as object with UTC seconds from epoch and fractional seconds as stated in docs

## [0.1.3] - 2025-05-21

- keeps logged error with properties, unless ignored in ignore keys

## [0.1.2] - 2025-05-02

- map serialized error to source location

## [0.1.1] - 2025-05-02

- add SpanContext class to facilitate executing without request context
- expose function to get tracing context trace flags
- fix readme

## [0.1.0] - 2025-04-24

- support fastify hook

## [0.0.4] - 2025-04-07

- type: make flags optional for `getTraceHeadersAsObject` as well

## [0.0.3] - 2025-04-03

- map error stack to textPayload
- ignore mixed in properties that are null or undefined
- start documenting api

## [0.0.2] - 2025-03-31

- map error stack to source location

## [0.0.1] - 2025-03-29

First version
