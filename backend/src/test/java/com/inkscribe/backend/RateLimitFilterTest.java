package com.inkscribe.backend;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import static org.junit.jupiter.api.Assertions.assertEquals;

class RateLimitFilterTest {

    private int status(RateLimitFilter f, String ip) throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest("POST", "/api/auth/login");
        req.setRemoteAddr(ip);
        MockHttpServletResponse res = new MockHttpServletResponse();
        f.doFilter(req, res, new MockFilterChain());
        return res.getStatus();
    }

    @Test
    void bloque_apres_la_limite_et_isole_les_adresses_ip() throws Exception {
        RateLimitFilter f = new RateLimitFilter(3, 2);
        for (int i = 0; i < 3; i++) assertEquals(200, status(f, "10.0.0.1"));
        assertEquals(429, status(f, "10.0.0.1"));
        assertEquals(200, status(f, "10.0.0.2"));
    }
}