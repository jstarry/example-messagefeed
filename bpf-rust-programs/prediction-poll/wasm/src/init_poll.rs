use alloc::boxed::Box;
use alloc::string::String;
use prediction_poll_data::InitPollData;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct InitPoll {
    header: String,
    option_a: String,
    option_b: String,
    timeout: u32,
}

#[wasm_bindgen]
impl InitPoll {
    #[wasm_bindgen(constructor)]
    pub fn new(header: String, option_a: String, option_b: String, timeout: u32) -> Self {
        Self {
            header,
            option_a,
            option_b,
            timeout,
        }
    }

    #[wasm_bindgen(js_name = toBytes)]
    pub fn to_bytes(&mut self) -> Box<[u8]> {
        let timeout = self.timeout;

        let header = self.header.as_bytes();
        let header_len = header.len() as u32;

        let option_a = self.option_a.as_bytes();
        let option_a_len = option_a.len() as u32;

        let option_b = self.option_b.as_bytes();
        let option_b_len = option_b.len() as u32;

        let data = InitPollData {
            timeout,
            header_len,
            header,
            option_a_len,
            option_a,
            option_b_len,
            option_b,
        };

        data.to_bytes().into_boxed_slice()
    }
}
