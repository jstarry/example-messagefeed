use alloc::borrow::ToOwned;
use alloc::boxed::Box;
use alloc::string::{String, ToString};
use alloc::vec::Vec;
use core::str::from_utf8;
use prediction_poll_data::PollData;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct Poll {
    header: String,
    option_a: String,
    option_b: String,
    timeout: u32,
}

impl From<PollData<'_>> for Poll {
    fn from(poll_data: PollData) -> Self {
        Self {
            header: from_utf8(poll_data.header).unwrap().to_string(),
            option_a: from_utf8(poll_data.option_a).unwrap().to_string(),
            option_b: from_utf8(poll_data.option_b).unwrap().to_string(),
            timeout: poll_data.timeout.to_owned(),
        }
    }
}

impl Poll {
    fn into_data(&self) -> Vec<u8> {
        let timeout = self.timeout;

        let header = self.header.as_bytes();
        let header_len = header.len() as u32;

        let option_a = self.option_a.as_bytes();
        let option_a_len = option_a.len() as u32;

        let option_b = self.option_b.as_bytes();
        let option_b_len = option_b.len() as u32;

        let data = PollData {
            timeout,
            header_len,
            header,
            option_a_len,
            option_a,
            option_b_len,
            option_b,
        };

        data.to_bytes()
    }
}

#[wasm_bindgen]
impl Poll {
    #[wasm_bindgen(constructor)]
    pub fn new(header: String, option_a: String, option_b: String, timeout: u32) -> Self {
        Poll {
            header,
            option_a,
            option_b,
            timeout,
        }
    }

    #[wasm_bindgen(js_name = getHeader)]
    pub fn get_header(&self) -> String {
        self.header.clone()
    }

    #[wasm_bindgen(js_name = fromData)]
    pub fn from_data(val: &mut [u8]) -> Self {
        console_error_panic_hook::set_once();
        PollData::from_bytes(val).into()
    }

    #[wasm_bindgen(js_name = toData)]
    pub fn to_data(&mut self) -> Box<[u8]> {
        self.into_data().into_boxed_slice()
    }
}
