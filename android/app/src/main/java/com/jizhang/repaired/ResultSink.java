package com.jizhang.repaired;
interface ResultSink { void send(String id, boolean ok, boolean cancelled, Object data, String error); }
