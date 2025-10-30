import {
  attachTraceIdHandler,
  getLogTrace,
  getSpanId,
  getTraceId,
  getTracingFlags,
  SpanContext,
  createTraceId,
  createSpanId,
  formatTraceparent,
} from '@aller/pino-gcp-transport/tracing';

describe('tracing', () => {
  it('getTraceId returns trace id', async () => {
    await attachTraceIdHandler(() => {
      expect(getTraceId()).to.equal('abc-123');
    }, 'abc-123');
  });

  it('getSpanId returns span id', async () => {
    await attachTraceIdHandler(
      () => {
        expect(getSpanId()).to.equal('span-1');
      },
      'abc-123',
      'span-1'
    );
  });

  it('getTraceId without async context returns nothing', () => {
    expect(getTraceId()).to.be.undefined;
  });

  it('getSpanId without async context returns nothing ', () => {
    expect(getSpanId()).to.be.undefined;
  });

  it('attachTraceIdHandler with throwing handler throws', async () => {
    try {
      await attachTraceIdHandler(
        () => {
          throw new Error('expected');
        },
        'abc-123',
        'span-1'
      );
    } catch (err) {
      // eslint-disable-next-line no-var
      var error = err;
    }

    expect(error).to.match(/expected/);
  });

  it('attachTraceIdHandler with falsy trace id a generated one', async () => {
    await attachTraceIdHandler(
      () => {
        const traceId = getTraceId();
        expect(getTraceId()).to.match(/^[0-9a-f]{32}$/);
        expect(getTraceId()).to.equal(traceId);
      },
      false,
      'span-1'
    );
  });

  it('getLogTrace without project id returns nothing', () => {
    expect(getLogTrace()).to.be.undefined;
    expect(getLogTrace({})).to.be.undefined;
  });

  it('getLogTrace outside a async trace context nothing', () => {
    expect(getLogTrace('aller-project-id')).to.be.undefined;
  });

  describe('formatTraceparent', () => {
    it('formats traceing arguments to traceparent header value', () => {
      expect(formatTraceparent('traceid')).to.match(/^00-traceid-\w+-00/);
      expect(formatTraceparent('traceid', 'spanid')).to.equal('00-traceid-spanid-00');
      expect(formatTraceparent('traceid', 'spanid', 'tracingflags')).to.equal('00-traceid-spanid-00');
      expect(formatTraceparent('traceid', 'spanid', 1)).to.equal('00-traceid-spanid-01');
      expect(formatTraceparent('traceid', 'spanid', 17)).to.equal('00-traceid-spanid-11');
      expect(formatTraceparent('traceid', 'spanid', '17')).to.equal('00-traceid-spanid-11');
      expect(formatTraceparent('traceid', null, 0)).to.match(/^00-traceid-\w+-00/);
      expect(formatTraceparent(null, 'spanid', 0)).to.match(/^00-\w+-spanid-00/);
    });
  });

  describe('SpanContext', () => {
    it('runInNewSpanContext(fn, ...args) captures tracing', async () => {
      const res = await new SpanContext('contexttraceid1', undefined, 0).runInNewSpanContext(function track(foo) {
        return new Promise((resolve) => {
          resolve({ foo, traceId: getTraceId(), spanId: getSpanId(), flags: getTracingFlags() });
        });
      }, 'bar');

      expect(res).to.have.property('foo', 'bar');
      expect(res).to.have.property('traceId', 'contexttraceid1');
      expect(res).to.have.property('flags', 0);
      expect(res).to.have.property('spanId').that.is.ok;
    });

    it('runInNewSpanContext with flags = 1 forwards flags', async () => {
      const res = await new SpanContext('contexttraceid1', undefined, 1).runInNewSpanContext(function track(foo) {
        return new Promise((resolve) => {
          resolve({ foo, traceId: getTraceId(), spanId: getSpanId(), flags: getTracingFlags() });
        });
      }, 'bar');

      expect(res).to.have.property('foo', 'bar');
      expect(res).to.have.property('traceId', 'contexttraceid1');
      expect(res).to.have.property('flags', 1);
      expect(res).to.have.property('spanId').that.is.ok;
    });

    it('runInNewSpanContext without flags defaults to 0', async () => {
      const res = await new SpanContext('contexttraceid1').runInNewSpanContext(function track(foo) {
        return new Promise((resolve) => {
          resolve({ foo, traceId: getTraceId(), spanId: getSpanId(), flags: getTracingFlags() });
        });
      }, 'bar');

      expect(res).to.have.property('foo', 'bar');
      expect(res).to.have.property('traceId', 'contexttraceid1');
      expect(res).to.have.property('flags', 0);
      expect(res).to.have.property('spanId').that.is.ok;
    });

    it('runInTraceContext with throwing handler throws', async () => {
      try {
        await new SpanContext('contexttraceid1').runInNewSpanContext(function track() {
          return new Promise(() => {
            throw new Error('test error');
          });
        }, 'bar');
      } catch (err) {
        // eslint-disable-next-line no-var
        var error = err;
      }

      expect(error.message).to.equal('test error');
    });

    it('runInNewSpanContext in runInNewSpanContext keeps traceId but updates span', async () => {
      const traceId = createTraceId();
      const spanId = createSpanId();

      const res = await new SpanContext(traceId, spanId).runInNewSpanContext(handler, 'bar');

      expect(res).to.have.length(3);

      expect(res[0]).to.have.property('foo', 'bar');
      expect(res[0]).to.have.property('traceId', traceId);
      expect(res[0]).to.have.property('spanId').that.is.ok.and.not.equal(spanId);

      expect(res[1]).to.have.property('foo', 'bar');
      expect(res[1]).to.have.property('traceId', traceId);
      expect(res[1]).to.have.property('spanId').that.is.ok.and.not.equal(res[0].spanId, 'first compared to inner span id');

      expect(res[2]).to.have.property('foo', 'bar');
      expect(res[2]).to.have.property('traceId', traceId);
      expect(res[2]).to.have.property('spanId').that.is.ok.and.equal(res[0].spanId, 'first compared to second span id');

      async function handler(foo1) {
        const tracing = [{ foo: foo1, traceId: getTraceId(), spanId: getSpanId() }];

        await new SpanContext().runInNewSpanContext(function track(foo2) {
          return new Promise((resolve) => {
            tracing.push({ foo: foo2, traceId: getTraceId(), spanId: getSpanId() });
            resolve();
          });
        }, foo1);

        tracing.push({ foo: foo1, traceId: getTraceId(), spanId: getSpanId() });

        return tracing;
      }
    });
  });
});
