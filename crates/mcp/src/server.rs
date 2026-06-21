use std::future::{self, Future};

use rmcp::handler::server::router::tool::ToolRouter;
use rmcp::model::{
    AnnotateAble, Implementation, ListResourcesResult, PaginatedRequestParams, RawResource,
    ReadResourceRequestParams, ReadResourceResult, ResourceContents, ServerCapabilities,
    ServerInfo,
};
use rmcp::service::{MaybeSendFuture, RequestContext, RoleServer};
use rmcp::{tool_handler, ErrorData as RmcpError, ServerHandler};
use vrcx_0_persistence::social_aggregates;

use crate::runtime::McpRuntime;

const DATA_CAVEATS_URI: &str = "vrcx://data-caveats";

pub(crate) struct VrcxMcpServer {
    pub(crate) runtime: McpRuntime,
    pub(crate) tool_router: ToolRouter<Self>,
}

#[tool_handler(router = self.tool_router)]
impl ServerHandler for VrcxMcpServer {
    fn get_info(&self) -> ServerInfo {
        ServerInfo::new(
            ServerCapabilities::builder()
                .enable_tools()
                .enable_resources()
                .build(),
        )
        .with_server_info(Implementation::new("vrcx-0", env!("CARGO_PKG_VERSION")))
        .with_instructions(
            "VRCX-0 exposes observer-centered VRChat social facts. Treat missing data as unobserved, not false; mention privacy and visibility limits when answering.",
        )
    }

    fn list_resources(
        &self,
        _request: Option<PaginatedRequestParams>,
        _context: RequestContext<RoleServer>,
    ) -> impl Future<Output = Result<ListResourcesResult, RmcpError>> + MaybeSendFuture + '_ {
        let resource = RawResource::new(DATA_CAVEATS_URI, "data_caveats")
            .with_title("VRCX-0 Data Caveats")
            .with_description("Observer-centered data caveats for all VRCX-0 MCP tools.")
            .with_mime_type("text/plain")
            .no_annotation();
        future::ready(Ok(ListResourcesResult::with_all_items(vec![resource])))
    }

    fn read_resource(
        &self,
        request: ReadResourceRequestParams,
        _context: RequestContext<RoleServer>,
    ) -> impl Future<Output = Result<ReadResourceResult, RmcpError>> + MaybeSendFuture + '_ {
        if request.uri != DATA_CAVEATS_URI {
            return future::ready(Err(RmcpError::invalid_params(
                "Unknown VRCX-0 MCP resource",
                None,
            )));
        }
        future::ready(Ok(ReadResourceResult::new(vec![ResourceContents::text(
            social_aggregates::data_caveats_resource(),
            DATA_CAVEATS_URI,
        )
        .with_mime_type("text/plain")])))
    }
}
